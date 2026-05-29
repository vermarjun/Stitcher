import { Request, Response } from 'express';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import crypto from 'crypto';
import GenerateChat, { IGenerateChat, IGenerateChatMessage } from '../model/generateChat.model';
import GenerationJob from '../model/generationJob.model';
import Project, { IProject } from '../model/project.model';
import User from '../model/user.model';
import Asset from '../model/asset.model';
import { enqueueGeneration } from '../queue/generationQueue';
import { resolveModelConfig, hasOwnKeys } from '../queue/modelConfig.util';
import { publishProgress } from '../queue/eventPublisher.util';
import { createJobRecord } from '../queue/jobTracker.util';
import type { Document } from 'mongoose';

// ─── POST / — main generation entry ──────────────────────────────────────────
// Validates input, creates/finds the GenerateChat doc, enqueues a BullMQ job,
// and returns 202 immediately.  The worker is the source of truth for progress
// and completion.

export const generateChatResponse = async (req: Request, res: Response) => {
    const { projectId, prompt, chatId, generationOptions } = req.body as {
        projectId?: string;
        prompt?: string;
        chatId?: string;
        generationOptions?: {
            targetTotalDurationSec?: number;
            minScenes?: number;
            maxScenes?: number;
            quality?: 'low' | 'medium' | 'high';
        };
    };
    const userId = req.userId;

    if (!projectId || !prompt?.trim()) {
        res.status(400).json({ success: false, message: 'Project ID and prompt are required' });
        return;
    }

    if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
    }

    // Credit pre-check (atomic deduction happens inside the worker after success)
    const user = await User.findById(userId).select('credits isTestAccount').lean();
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    // BYOT exhaust path: once credits hit zero, users who supplied their own
    // provider keys may keep generating at no cost. Mirror the worker gate so
    // the job is actually enqueued for them. resolveModelConfig never throws.
    if (!user.isTestAccount && user.credits.generation <= 0) {
        const modelConfig = await resolveModelConfig(userId);
        if (!hasOwnKeys(modelConfig)) {
            res.status(402).json({
                success: false,
                message: 'Not enough credits to generate. Add your own API keys in Settings to keep going, or upgrade your plan.',
            });
            return;
        }
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found or access denied' });
        return;
    }

    // Get or create the GenerateChat document
    let chat: IGenerateChat | null;
    let isNewChat = false;

    if (chatId) {
        chat = await GenerateChat.findOne({ _id: chatId, projectId: new Types.ObjectId(projectId) });
        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }
    } else {
        chat = new GenerateChat({
            projectId: new Types.ObjectId(projectId),
            messages: [],
            title: prompt.trim().substring(0, 50),
            userId,
        });
        isNewChat = true;
    }

    // Push the user message
    const userMessage: IGenerateChatMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date(),
        scenes: [],
        projectDescription: '',
        completed: false,
        plannerOut: false,
        generatorOutput: false,
        error: 'none',
        requestType: 'generate',
        assetsToEdit: [],
    };
    chat.messages.push(userMessage);

    // Push a placeholder assistant message (worker will fill it in)
    const assistantMessage: IGenerateChatMessage = {
        role: 'assistant',
        content: { plannerOutput: '', llmResponse: '' },
        timestamp: new Date(),
        scenes: [],
        projectDescription: '',
        completed: false,
        plannerOut: false,
        generatorOutput: false,
        error: 'none',
        requestType: undefined,
        assetsToEdit: [],
    };
    chat.messages.push(assistantMessage);

    await chat.save();

    if (isNewChat) {
        project.edit_chat = chat._id as Types.ObjectId;
        await project.save();
    }

    const resolvedChatId = (chat._id as Types.ObjectId).toString();
    const traceId = (req as Request & { id?: string }).id ?? crypto.randomUUID();

    // Enqueue the BullMQ job
    const jobId = await enqueueGeneration({
        chatId: resolvedChatId,
        userId,
        projectId,
        prompt,
        generationOptions,
        traceId,
    });

    // Record the job in the user's generation history (F2.4). Non-fatal — a DB
    // hiccup here must never block the generation that is already enqueued.
    await createJobRecord({
        jobId,
        queue: 'generation',
        userId,
        projectId,
        chatId: resolvedChatId,
        prompt,
        traceId,
    }).catch(() => undefined);

    // Publish a queued event so the frontend knows work has started
    publishProgress(resolvedChatId, { type: 'job_queued', phase: 'controller', data: { jobId } });

    res.status(202).json({
        success: true,
        data: { chatId: resolvedChatId, jobId },
    });
};

// ─── GET /jobs — generation/edit history for the authenticated user (F2.4) ────
// Returns the user's jobs newest-first. Ownership-scoped by req.userId so users
// only ever see their own generations.
//   ?status=active  → in-flight jobs (not complete/failed/cancelled)
//   ?status=recent  → terminal jobs (complete/failed/cancelled)
//   (omitted)       → all
//   ?limit, ?skip   → pagination (limit clamped to 1..100, default 25)

export const getUserJobs = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        const { status, limit, skip } = req.query as {
            status?: string;
            limit?: string;
            skip?: string;
        };

        const ACTIVE_STATUSES = ['queued', 'planning', 'rendering', 'concatenating', 'uploading'];
        const TERMINAL_STATUSES = ['complete', 'failed', 'cancelled'];

        const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
        if (status === 'active') {
            query['status'] = { $in: ACTIVE_STATUSES };
        } else if (status === 'recent') {
            query['status'] = { $in: TERMINAL_STATUSES };
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit ?? '25', 10) || 25, 1), 100);
        const parsedSkip = Math.max(parseInt(skip ?? '0', 10) || 0, 0);

        const jobs = await GenerationJob.find(query)
            .select('jobId queue projectId chatId prompt status sceneProgress finalUrl error startedAt completedAt createdAt updatedAt')
            .sort({ createdAt: -1 })
            .skip(parsedSkip)
            .limit(parsedLimit)
            .lean();

        res.status(200).json({ success: true, data: jobs });
    } catch (error) {
        console.error('Get user jobs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch generation jobs' });
    }
};

// ─── GET /update/:chatId — polling fallback ───────────────────────────────────

export const getChatUpdate = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { projectId } = req.query;

        if (!chatId || !projectId) {
            res.status(400).json({ success: false, message: 'Chat ID and Project ID are required' });
            return;
        }

        const chat = await GenerateChat.findOne({
            _id: chatId,
            projectId: new Types.ObjectId(projectId as string),
        }).lean();

        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        console.error('Get chat update error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat update' });
    }
};

// ─── GET /latest-message/:chatId ─────────────────────────────────────────────

export const getLatestAssistantMessage = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { projectId, userId } = req.query;

        if (!chatId || !projectId || !userId) {
            res.status(400).json({ success: false, message: 'Chat ID, Project ID, and User ID are required' });
            return;
        }

        const chat = await GenerateChat.findOne({
            _id: chatId,
            projectId: new Types.ObjectId(projectId as string),
        })
            .populate({
                path: 'messages.scenes.assetId',
                model: 'Asset',
                select: 'name type origin url thumbnail duration width height bytes metadata projectId isOnTimeline originalTemplateId',
            })
            .lean();

        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }

        const assistantMessages = chat.messages.filter((msg) => msg.role === 'assistant');
        if (assistantMessages.length === 0) {
            res.status(404).json({ success: false, message: 'No assistant messages found' });
            return;
        }

        const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
        res.status(200).json({ success: true, data: latestAssistantMessage });
    } catch (error) {
        console.error('Get latest assistant message error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch latest assistant message' });
    }
};

// ─── GET /:chatId — full chat history ────────────────────────────────────────

export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;

        const chat = await GenerateChat.findById(chatId).lean();
        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }

        // Populate assetId for each scene
        if (chat.messages) {
            for (let i = 0; i < chat.messages.length; i++) {
                const message = chat.messages[i];
                if (message.scenes && message.scenes.length > 0) {
                    for (let j = 0; j < message.scenes.length; j++) {
                        const scene = message.scenes[j];
                        if (scene.assetId) {
                            const asset = await Asset.findById(scene.assetId)
                                .select('name type origin url thumbnail duration width height bytes metadata isOnTimeline')
                                .lean();
                            if (asset) {
                                chat.messages[i].scenes[j] = { ...scene, assetId: asset as unknown as Types.ObjectId };
                            }
                        }
                    }
                }
            }
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
    }
};

// ─── GET /project/:projectId — list chats for a project ──────────────────────

export const getProjectChats = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const chats = await GenerateChat.find({ projectId })
            .select('_id title createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: chats });
    } catch (error) {
        console.error('Get project chats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch project chats' });
    }
};

// ─── POST /cancel/:chatId — mark latest assistant message cancelled ───────────

export const stopGeneration = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = req.userId;

        if (!chatId) {
            res.status(400).json({ success: false, message: 'Chat ID is required' });
            return;
        }
        if (!userId) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        const chat = await GenerateChat.findById(chatId);
        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }

        const assistantMessages = chat.messages.filter((msg) => msg.role === 'assistant');
        if (assistantMessages.length === 0) {
            res.status(404).json({ success: false, message: 'No assistant messages found to cancel' });
            return;
        }

        const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
        const messageIndex = chat.messages.findIndex(
            (msg) =>
                msg.role === 'assistant' &&
                msg.timestamp.getTime() === latestAssistantMessage.timestamp.getTime()
        );

        if (messageIndex === -1) {
            res.status(404).json({ success: false, message: 'Assistant message not found in chat array' });
            return;
        }

        chat.messages[messageIndex].completed = true;
        chat.messages[messageIndex].plannerOut = latestAssistantMessage.plannerOut || true;
        chat.messages[messageIndex].generatorOutput = latestAssistantMessage.generatorOutput || true;
        chat.messages[messageIndex].error = 'cancelled';

        if (typeof latestAssistantMessage.content === 'string') {
            chat.messages[messageIndex].content = 'Generation was cancelled by user.';
        } else {
            chat.messages[messageIndex].content = {
                plannerOutput: latestAssistantMessage.content.plannerOutput || '',
                llmResponse: latestAssistantMessage.content.llmResponse || 'Generation was cancelled by user.',
            };
        }

        chat.markModified('messages');
        await chat.save();

        res.status(200).json({
            success: true,
            data: {
                chatId: chat._id,
                message: 'Generation cancelled successfully',
                updatedMessage: chat.messages[messageIndex],
            },
        });
    } catch (error) {
        console.error('Stop generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel generation',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// ─── POST /complete — idempotent completion acknowledgement ──────────────────
// The worker is now the source of truth for completion and credit deduction.
// This endpoint is kept for backward-compatibility (old microservice callback
// pattern) but is now a lightweight acknowledgement only.
// Note: credit deduction is intentionally NOT performed here — the worker
// handles it atomically after a successful render.

export const completeGeneration = async (req: Request, res: Response) => {
    try {
        const { chatId, userId } = req.body as { chatId?: string; userId?: string; isEdited?: boolean };

        if (!chatId || !userId) {
            res.status(400).json({ success: false, message: 'Chat ID and User ID are required' });
            return;
        }

        // Verify the user exists (don't deduct — worker already did)
        const user = await User.findById(userId).select('_id isTestAccount').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        res.status(200).json({ success: true, message: 'Completion acknowledged' });
    } catch (error) {
        console.error('Complete generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete generation',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// ─── POST /guest — generation for unauthenticated users ─────────────────────
// Guest flow: find/create a shared guest user and project, enqueue a BullMQ
// job the same way as authenticated users.

export const generateGuestChatResponse = async (req: Request, res: Response) => {
    try {
        const { prompt, assetId }: { prompt?: string; assetId?: string } = req.body;

        if (!prompt?.trim()) {
            res.status(400).json({ success: false, message: 'Prompt is required' });
            return;
        }

        // 1. Find or create guest user
        const guestEmail = 'guest@stitcher.com';
        let guestUser = await User.findOne({ email: guestEmail });

        if (!guestUser) {
            guestUser = new User({
                username: 'guest',
                email: guestEmail,
                password: 'guest_password_' + Date.now(),
                role: 'user',
                plan: 'free',
                credits: {
                    generation: 1000,
                    editing: 1000,
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                },
                isTestAccount: true,
            });
            await guestUser.save();
        }

        // 2. Find or create guest project
        let guestProject: (IProject & Document) | null = null;
        if (guestUser.projects && guestUser.projects.length > 0) {
            guestProject = await Project.findById(guestUser.projects[0]);
        }

        if (!guestProject) {
            guestProject = new Project({ name: 'Guest Project', status: 'draft', bytes: 0 });
            await guestProject.save();
            guestUser.projects = guestUser.projects ?? [];
            guestUser.projects.push(guestProject._id as Types.ObjectId);
            await guestUser.save();
        }

        // 3. Create chat and enqueue (edit flow for guests not supported here)
        const chat = new GenerateChat({
            projectId: guestProject._id,
            messages: [],
            title: prompt.trim().substring(0, 50),
            userId: guestUser._id,
        });

        const userMessage: IGenerateChatMessage = {
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            scenes: [],
            projectDescription: '',
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: 'none',
            requestType: assetId ? 'edit' : 'generate',
            assetsToEdit: assetId ? [new mongoose.Types.ObjectId(assetId)] : [],
        };
        chat.messages.push(userMessage);

        const assistantMessage: IGenerateChatMessage = {
            role: 'assistant',
            content: { plannerOutput: '', llmResponse: '' },
            timestamp: new Date(),
            scenes: [],
            projectDescription: '',
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: 'none',
            requestType: undefined,
            assetsToEdit: [],
        };
        chat.messages.push(assistantMessage);
        await chat.save();

        if (!guestProject.edit_chat) {
            guestProject.edit_chat = chat._id as Types.ObjectId;
            await guestProject.save();
        }

        const resolvedChatId = (chat._id as Types.ObjectId).toString();
        const traceId = crypto.randomUUID();

        // Guest edit flow is not yet wired to the BullMQ pipeline — skip for now
        if (assetId) {
            res.status(501).json({ success: false, message: 'Guest edit flow not yet supported' });
            return;
        }

        const jobId = await enqueueGeneration({
            chatId: resolvedChatId,
            userId: (guestUser._id as Types.ObjectId).toString(),
            projectId: (guestProject._id as Types.ObjectId).toString(),
            prompt,
            traceId,
        });

        await createJobRecord({
            jobId,
            queue: 'generation',
            userId: (guestUser._id as Types.ObjectId).toString(),
            projectId: (guestProject._id as Types.ObjectId).toString(),
            chatId: resolvedChatId,
            prompt,
            traceId,
        }).catch(() => undefined);

        publishProgress(resolvedChatId, { type: 'job_queued', phase: 'controller', data: { jobId } });

        res.status(202).json({
            success: true,
            data: {
                chatId: resolvedChatId,
                projectId: guestProject._id,
                userId: guestUser._id,
                jobId,
                message: 'Guest generation started',
            },
        });
    } catch (error) {
        console.error('Guest chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate guest chat',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
