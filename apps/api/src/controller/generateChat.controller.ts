import { Request, Response } from 'express';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import crypto from 'crypto';
import GenerateChat, { IGenerateChat, IGenerateChatMessage } from '../model/generateChat.model';
import GenerationJob from '../model/generationJob.model';
import Project, { IProject } from '../model/project.model';
import User from '../model/user.model';
import Asset from '../model/asset.model';
import { enqueueGeneration, generationQueue } from '../queue/generationQueue';
import { resolveModelConfig, hasOwnKeys } from '../queue/modelConfig.util';
import { publishProgress } from '../queue/eventPublisher.util';
import { createJobRecord } from '../queue/jobTracker.util';
import { getPhaseMeta } from '../queue/pipelinePhases';
import { markCancelled } from '../queue/generationWorker';
import { redisConnection } from '../queue/connection';
import { config } from '../config';
import type { Document } from 'mongoose';

/**
 * Global daily ceiling on FREE-tier generations — a public-launch budget/abuse
 * guard. Increments a per-UTC-day Redis counter; returns false once the cap
 * (config.DAILY_FREE_GEN_CAP) is exceeded. FAILS OPEN: any Redis error returns
 * true so a cache hiccup never blocks all generations. Cap of 0 = disabled.
 */
async function underDailyFreeCap(): Promise<boolean> {
    const cap = config.DAILY_FREE_GEN_CAP;
    if (!cap || cap <= 0) return true;
    try {
        const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
        const key = `stitcher:freegen:${day}`;
        const n = await redisConnection.incr(key);
        if (n === 1) await redisConnection.expire(key, 60 * 60 * 48); // 2-day TTL
        return n <= cap;
    } catch {
        return true; // never block generations on a Redis error
    }
}

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
            voiceover?: {
                enabled: boolean;
                provider?: string;
                voice?: string;
                language?: string;
            };
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
    const user = await User.findById(userId).select('credits isTestAccount plan').lean();
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    // Public-launch budget guard: cap total FREE-tier generations per day across all
    // users so scripted/abusive signups can't drain the shared LLM budget. Paid and
    // test accounts are exempt (they don't draw on the free pool). Fail-open.
    const isFreeTier = (user.plan ?? 'free') === 'free' && !user.isTestAccount;
    if (isFreeTier && !(await underDailyFreeCap())) {
        res.status(429).json({
            success: false,
            message: 'We\'ve hit today\'s free-generation limit. Please try again tomorrow, or upgrade your plan for uninterrupted access.',
        });
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

    // NOTE: deliberately NOT writing chat._id onto project.edit_chat. Generate
    // chats are private per user and resolved via GET /generatechat/project/:id
    // (userId-scoped); project.edit_chat is reserved for the legacy pointer and
    // must not be hijacked by one user's generate chat on a shared project.
    void isNewChat;

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
    // …and an initial live-progress event so the bar + step label start moving
    // immediately (before the worker picks the job up). Mirrors PIPELINE_PHASES.
    {
        const q = getPhaseMeta('queued');
        publishProgress(resolvedChatId, {
            type: 'progress',
            phase: 'queued',
            data: { phase: 'queued', label: q.label, percent: q.percent, ceil: q.ceil },
        });
    }

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

        // Privacy: a chat belongs to exactly one user. Even project members
        // (including the owner) cannot read another member's chat history.
        if (chat.userId && req.userId && chat.userId.toString() !== req.userId) {
            res.status(403).json({ success: false, message: 'Forbidden' });
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
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        // Chats are PRIVATE per user (like memory): each collaborator only ever
        // sees their own AI conversations, even on a shared project. This also
        // backs per-user credit enforcement — you only generate against chats
        // tied to your own account.
        const chats = await GenerateChat.find({
            projectId,
            userId: new Types.ObjectId(userId),
        })
            .select('_id title createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: chats });
    } catch (error) {
        console.error('Get project chats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch project chats' });
    }
};

// ─── POST /cancel/:chatId ─────────────────────────────────────────────────────
// 1. Set a Redis flag so the running worker stops at its next checkpoint.
// 2. Remove the BullMQ job if it hasn't started yet (waiting/delayed).
// 3. Update the GenerationJob record and the chat message in Mongo.
// 4. Publish a socket event so the UI updates immediately.

export const stopGeneration = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = req.userId;

        if (!chatId) { res.status(400).json({ success: false, message: 'Chat ID is required' }); return; }
        if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

        // ── 1. Set the Redis cancellation flag ───────────────────────────────
        await markCancelled(chatId);

        // ── 2. Find the active GenerationJob and remove/stop the BullMQ job ─
        const genJob = await GenerationJob.findOne({
            chatId,
            status: { $in: ['queued', 'planning', 'generating', 'rendering', 'concatenating'] },
        }).sort({ createdAt: -1 });

        if (genJob?.jobId) {
            try {
                const bullJob = await generationQueue.getJob(genJob.jobId);
                if (bullJob) {
                    const state = await bullJob.getState();
                    // Waiting jobs can be removed immediately; active jobs will hit the checkpoint.
                    if (state === 'waiting' || state === 'delayed' || state === 'waiting-children') {
                        await bullJob.remove();
                    }
                }
            } catch {
                // Non-fatal — the Redis flag will stop the worker regardless.
            }
            // Mark the GenerationJob as failed/cancelled.
            await GenerationJob.findByIdAndUpdate(genJob._id, {
                status: 'failed',
                error: 'cancelled',
                completedAt: new Date(),
            });
        }

        // ── 3. Update the chat message in Mongo ──────────────────────────────
        const chat = await GenerateChat.findById(chatId);
        if (chat) {
            const assistantMessages = chat.messages.filter((m) => m.role === 'assistant');
            const latest = assistantMessages[assistantMessages.length - 1];
            if (latest) {
                const idx = chat.messages.findIndex(
                    (m) => m.role === 'assistant' && m.timestamp.getTime() === latest.timestamp.getTime()
                );
                if (idx !== -1) {
                    chat.messages[idx].completed = true;
                    chat.messages[idx].error = 'cancelled';
                    chat.messages[idx].content =
                        typeof latest.content === 'string'
                            ? 'Generation was cancelled.'
                            : { plannerOutput: (latest.content as { plannerOutput?: string }).plannerOutput ?? '', llmResponse: 'Generation was cancelled.' };
                    chat.markModified('messages');
                    await chat.save();
                }
            }
        }

        // ── 4. Publish socket event for immediate UI feedback ────────────────
        publishProgress(chatId, {
            type: 'job_complete',
            phase: 'cancelled',
            data: { status: 'cancelled', finalUrl: null },
        });

        res.status(200).json({ success: true, data: { chatId, message: 'Generation cancelled' } });
    } catch (error) {
        console.error('stopGeneration error:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel generation' });
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

// ─── GET /:chatId/status — lightweight polling fallback ──────────────────────
// Returns { status, finalUrl, jobId } for the most recent job tied to this chat.
// The frontend polls this when the socket misses the 'job_complete' event.
// Auth-gated + ownership-checked: only the chat owner can query it.

export const getChatStatus = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        if (!chatId || !Types.ObjectId.isValid(chatId)) {
            res.status(400).json({ success: false, message: 'Invalid chat id' });
            return;
        }

        // Ownership check: only the chat's owner may poll status.
        const chat = await GenerateChat.findById(chatId).select('userId projectId messages').lean();
        if (!chat) {
            res.status(404).json({ success: false, message: 'Chat not found' });
            return;
        }

        const isOwner =
            (chat.userId && chat.userId.toString() === userId) ||
            !!(await User.exists({
                _id: new Types.ObjectId(userId),
                projects: chat.projectId,
            }));

        if (!isOwner) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }

        // Fetch the most recent job for this chat (newest-first)
        const job = await GenerationJob.findOne({ chatId: new Types.ObjectId(chatId) })
            .select('jobId status progress finalUrl sceneProgress startedAt completedAt')
            .sort({ createdAt: -1 })
            .lean();

        // Also pull the finalUrl from the last assistant message content as a
        // fallback: if the job doc was GC'd or not yet created, the chat message
        // is the ground truth.
        let finalUrlFallback: string | undefined;
        if (chat.messages && chat.messages.length > 0) {
            const lastAssistant = [...chat.messages].reverse().find((m) => m.role === 'assistant');
            if (lastAssistant && typeof lastAssistant.content === 'object') {
                finalUrlFallback = (lastAssistant.content as { llmResponse?: string }).llmResponse || undefined;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                jobId: job?.jobId ?? null,
                status: job?.status ?? (finalUrlFallback ? 'complete' : 'unknown'),
                // Live granular progress (phase + label + percent + ceil) so a page
                // reload restores the exact bar position + step label.
                progress: job?.progress ?? null,
                finalUrl: job?.finalUrl ?? finalUrlFallback ?? null,
                sceneProgress: job?.sceneProgress ?? null,
                startedAt: job?.startedAt ?? null,
                completedAt: job?.completedAt ?? null,
            },
        });
    } catch (error) {
        console.error('Get chat status error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat status' });
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

// ─── PATCH /:chatId/rating — RLHF rating ─────────────────────────────────────

/**
 * PATCH /api/generatechat/:chatId/rating
 *
 * Body: { rating: 1..5, jobId?: string }
 * Auth: chat owner (requireChatOwnership applied at router level)
 *
 * Sets GenerationJob.rating + ratedAt for the specified job (or the most
 * recent completed job for this chat if jobId is omitted). Also mirrors the
 * rating onto the chat's last assistant message so the UI can persist state.
 */
export const rateChatGeneration = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { rating, jobId } = req.body as { rating?: number; jobId?: string };

    if (!chatId || !Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ error: { message: "invalid chatId" } });
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({ error: { message: "rating must be an integer 1–5" } });
    }

    try {
        // Find the target job (by provided jobId, or fall back to latest complete)
        let job;
        if (jobId) {
            job = await GenerationJob.findOne({
                chatId: new Types.ObjectId(chatId),
                $or: [
                    { jobId: jobId },
                    ...(Types.ObjectId.isValid(jobId) ? [{ _id: new Types.ObjectId(jobId) }] : []),
                ],
            }).select("_id jobId");
        }
        if (!job) {
            job = await GenerationJob.findOne({
                chatId: new Types.ObjectId(chatId),
                status: "complete",
            })
                .sort({ createdAt: -1 })
                .select("_id jobId");
        }
        if (!job) {
            return res.status(404).json({ error: { message: "No completed generation found for this chat" } });
        }

        const ratedAt = new Date();
        await GenerationJob.updateOne(
            { _id: job._id },
            { $set: { rating, ratedAt } }
        );

        // Mirror rating onto the chat's last assistant message (best-effort).
        await GenerateChat.findByIdAndUpdate(chatId, {
            $set: { "messages.$[last].rating": rating },
        }, {
            arrayFilters: [{ "last.role": "assistant" }],
        }).catch(() => {/* non-fatal */});

        return res.status(200).json({ ok: true, jobId: job.jobId, rating, ratedAt });
    } catch (err) {
        return res.status(500).json({ error: { message: "Failed to save rating", detail: String(err) } });
    }
};
