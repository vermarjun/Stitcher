import { Request, Response } from 'express';
import { Types } from 'mongoose';
import axios from 'axios';
import GenerateChat, { IGenerateChat, IGenerateChatMessage } from '../model/generateChat.model';
import Project from '../model/project.model';
import ApiKey from '../model/userapikeys.model';
import { MICROSERVICE_BASE_URL } from '../config';
import User from '../model/user.model';
import Asset from '../model/asset.model';
import mongoose from 'mongoose';

interface GenerateChatRequest {
    projectId: string;
    prompt: string;
    chatId?: string;
}

interface ApiKeyMapping {
    planner: { keyValue: string; baseUrl: string; modelName: string };
    coder: { keyValue: string; baseUrl: string; modelName: string };
    reviewer: { keyValue: string; baseUrl: string; modelName: string };
    debugger: { keyValue: string; baseUrl: string; modelName: string };
    general: { keyValue: string; baseUrl: string; modelName: string };
}

// Fetches API keys for the user and fills missing ones with general agent credentials
async function fetchApiKeysForUser(userId: string): Promise<ApiKeyMapping> {
    const userApiKeys = await ApiKey.find({
        userId,
        isActive: true
    });

    const keyMap = new Map<string, { keyValue: string; baseUrl: string; modelName: string }>();
    userApiKeys.forEach(key => {
        keyMap.set(key.agentId, {
            keyValue: key.keyValue,
            baseUrl: key.baseUrl,
            modelName: key.modelName
        });
    });

    const generalCreds = keyMap.get('general');
    if (!generalCreds) {
        throw new Error('General agent API key is required but not found');
    }

    const apiKeyMapping: ApiKeyMapping = {
        planner: keyMap.get('planner') || generalCreds,
        coder: keyMap.get('coder') || generalCreds,
        reviewer: keyMap.get('reviewer') || generalCreds,
        debugger: keyMap.get('debugger') || generalCreds,
        general: generalCreds
    };

    return apiKeyMapping;
}

interface GenerateChatRequest {
    projectId: string;
    prompt: string;
    chatId?: string;
    assetId?: string[];
}

async function callVideoGenerationMicroservice(
    prompt: string,
    userName: string,
    projectId: string,
    userId: string,
    chatId: string,
    apiKeys: ApiKeyMapping
): Promise<{ status: 'success' | 'error', error?: any }> {
    try {
        const response = await axios.post(
            `${MICROSERVICE_BASE_URL}/generate/video`,
            {
                userName: userName,
                prompt: prompt,
                projectId: projectId,
                userId: userId,
                chatId: chatId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-planner-api-key': apiKeys.planner.keyValue,
                    'x-planner-base-url': apiKeys.planner.baseUrl,
                    'x-planner-model': apiKeys.planner.modelName,
                    'x-generator-api-key': apiKeys.coder.keyValue,
                    'x-generator-base-url': apiKeys.coder.baseUrl,
                    'x-generator-model': apiKeys.coder.modelName,
                    'x-merger-api-key': apiKeys.reviewer.keyValue,
                    'x-merger-base-url': apiKeys.reviewer.baseUrl,
                    'x-merger-model': apiKeys.reviewer.modelName,
                    'x-debugger-api-key': apiKeys.debugger.keyValue,
                    'x-debugger-base-url': apiKeys.debugger.baseUrl,
                    'x-debugger-model': apiKeys.debugger.modelName,
                    'x-general-api-key': apiKeys.general.keyValue,
                    'x-general-base-url': apiKeys.general.baseUrl,
                    'x-general-model': apiKeys.general.modelName
                },
                timeout: 300000
            }
        );

        console.log('Microservice response:', response.data);
        return { status: 'success' };
    } catch (error) {
        console.error('Microservice call error:', error);
        const err = error as any;
        if (err.response) {
            console.error('Response data:', err.response.data);
            console.error('Response status:', err.response.status);
            console.error('Request config:', err.config);
        }
        return { status: 'error', error };
    }
}

async function callVideoEditMicroservice(
    prompt: string,
    userName: string,
    projectId: string,
    userId: string,
    chatId: string,
    assetId: string[],
    apiKeys: ApiKeyMapping
): Promise<{ status: 'success' | 'error', error?: any }> {
    try {
        const response = await axios.post(
            `${MICROSERVICE_BASE_URL}/edit/video`,
            {
                userName: userName,
                prompt: prompt,
                projectId: projectId,
                userId: userId,
                assetId: assetId,
                chatId: chatId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-planner-api-key': apiKeys.planner.keyValue,
                    'x-planner-base-url': apiKeys.planner.baseUrl,
                    'x-planner-model': apiKeys.planner.modelName,
                    'x-generator-api-key': apiKeys.coder.keyValue,
                    'x-generator-base-url': apiKeys.coder.baseUrl,
                    'x-generator-model': apiKeys.coder.modelName,
                    'x-merger-api-key': apiKeys.reviewer.keyValue,
                    'x-merger-base-url': apiKeys.reviewer.baseUrl,
                    'x-merger-model': apiKeys.reviewer.modelName,
                    'x-debugger-api-key': apiKeys.debugger.keyValue,
                    'x-debugger-base-url': apiKeys.debugger.baseUrl,
                    'x-debugger-model': apiKeys.debugger.modelName,
                    'x-general-api-key': apiKeys.general.keyValue,
                    'x-general-base-url': apiKeys.general.baseUrl,
                    'x-general-model': apiKeys.general.modelName
                },
                timeout: 300000
            }
        );

        console.log('Microservice response:', response.data);
        return { status: 'success' };
    } catch (error) {
        console.error('Microservice call error:', error);
        const err = error as any;
        if (err.response) {
            console.error('Response data:', err.response.data);
            console.error('Response status:', err.response.status);
            console.error('Request config:', err.config);
        }
        return { status: 'error', error };
    }
}

export const generateChatResponse = async (req: Request, res: Response) => {
    try {
        const { projectId, prompt, chatId, assetId }: GenerateChatRequest = req.body;
        const userId = req.userId;

        // Validation
        if (!projectId || !prompt?.trim()) {
            res.status(400).json({
                success: false,
                message: 'Project ID and prompt are required'
            });
            return;
        }

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const user = await User.findById(userId);

        if (assetId && assetId.length > 0) {
            // means edit request hai
            // check if user has enough credits available
            if (!user?.credits.editing || user?.credits.editing <= 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Not Enough credits to complete edit request.'
                });
            }
        } else {
            // request is to generate a video
            if (!user?.credits.generation || user?.credits.generation <= 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Not Enough credits to complete generate request.'
                });
            }
        }

        // Verify project exists
        const project = await Project.findById(projectId);
        if (!project) {
            res.status(404).json({
                success: false,
                message: 'Project not found or access denied'
            });
            return;
        }

        // Fetch API keys for the user
        let apiKeys: ApiKeyMapping;
        try {
            apiKeys = await fetchApiKeysForUser(userId);
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch API keys'
            });
            return;
        }

        // Get or create chat
        let chat: IGenerateChat | null;
        let isNewChat = false;

        if (chatId) {
            chat = await GenerateChat.findOne({
                _id: chatId,
                projectId: new Types.ObjectId(projectId)
            });

            if (!chat) {
                res.status(404).json({
                    success: false,
                    message: 'Chat not found'
                });
                return;
            }
        } else {
            // Create new chat
            chat = new GenerateChat({
                projectId: new Types.ObjectId(projectId),
                messages: [],
                title: prompt.trim().substring(0, 50),
                userId: userId
            });
            isNewChat = true;
        }

        // Add user message to chat
        const userMessage: IGenerateChatMessage = {
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            scenes: [],
            projectDescription: "",
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: "none",
            requestType: (assetId && assetId.length > 0) ? "edit" : "generate",
            assetsToEdit: assetId?.map(id => new mongoose.Types.ObjectId(id)) || [] //assetId is array of string, convert to array of objectId before saving it
        };
        chat.messages.push(userMessage);

        // Add placeholder assistant message
        const assistantMessage: IGenerateChatMessage = {
            role: 'assistant',
            content: {
                plannerOutput: "",
                llmResponse: ""
            },
            timestamp: new Date(),
            scenes: [],
            projectDescription: "",
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: "none",
            requestType: undefined,
            assetsToEdit: []
        };
        chat.messages.push(assistantMessage);

        // Save chat
        await chat.save();

        // Update project's edit_chat reference if it's a new chat
        if (isNewChat) {
            project.edit_chat = chat._id as Types.ObjectId;
            await project.save();
        }

        // Call appropriate microservice based on assetId presence
        let microserviceResult;
        if (assetId && assetId.length > 0) {
            microserviceResult = await callVideoEditMicroservice(
                prompt,
                user?.username || "arjun",
                projectId,
                userId,
                (chat._id as Types.ObjectId).toString(),
                assetId,
                apiKeys
            );
        } else {
            microserviceResult = await callVideoGenerationMicroservice(
                prompt,
                user?.username || "arjun",
                projectId,
                userId,
                (chat._id as Types.ObjectId).toString(),
                apiKeys
            );
        }

        if (microserviceResult.status === 'error') {
            res.status(503).json({
                success: false,
                message: 'Microservice is not reachable'
            });
            return;
        }

        // Return success response
        res.status(200).json({
            success: true,
            data: {
                chatId: chat._id,
                message: 'Request sent to microservice successfully'
            }
        });
    } catch (error) {
        console.error('Generate chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate chat response',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

// Get updated chat - for polling by frontend
export const getChatUpdate = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { projectId } = req.query;

        if (!chatId || !projectId) {
            res.status(400).json({
                success: false,
                message: 'Chat ID and Project ID are required'
            });
            return;
        }

        const chat = await GenerateChat.findOne({
            _id: chatId,
            projectId: new Types.ObjectId(projectId as string)
        }).lean();

        if (!chat) {
            res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: chat
        });
    } catch (error) {
        console.error('Get chat update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chat update'
        });
    }
}

// Get latest assistant message - for polling updates from microservice
export const getLatestAssistantMessage = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { projectId, userId } = req.query;

        if (!chatId || !projectId || !userId) {
            res.status(400).json({
                success: false,
                message: 'Chat ID, Project ID, and User ID are required'
            });
            return;
        }

        const chat = await GenerateChat.findOne({
            _id: chatId,
            projectId: new Types.ObjectId(projectId as string)
        })
            .populate({
                path: 'messages.scenes.assetId',
                model: 'Asset',
                select: 'name type origin url thumbnail duration width height bytes metadata projectId isOnTimeline originalTemplateId' // Specify fields you want
            })
            .lean();

        if (!chat) {
            res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
            return;
        }

        // Find the last assistant message
        const assistantMessages = chat.messages.filter(msg => msg.role === 'assistant');

        if (assistantMessages.length === 0) {
            res.status(404).json({
                success: false,
                message: 'No assistant messages found'
            });
            return;
        }

        const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];

        res.status(200).json({
            success: true,
            data: latestAssistantMessage
        });
    } catch (error) {
        console.error('Get latest assistant message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch latest assistant message'
        });
    }
}

// Get chat history
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;

        const chat = await GenerateChat.findById(chatId).lean();

        if (!chat) {
            res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
            return;
        }

        // Manually populate assetId for each scene in each message
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
                                // Create new scene object with populated asset
                                chat.messages[i].scenes[j] = {
                                    ...scene,
                                    assetId: asset as any
                                };
                            }
                        }
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            data: chat
        });
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chat history'
        });
    }
}

// Get all chats for a project
export const getProjectChats = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const chats = await GenerateChat.find({ projectId })
            .select('_id title createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: chats
        });
    } catch (error) {
        console.error('Get project chats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch project chats'
        });
    }
}
export const stopGeneration = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = req.userId;

        // Validation
        if (!chatId) {
            res.status(400).json({
                success: false,
                message: 'Chat ID is required'
            });
            return;
        }

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        // Find the chat
        const chat = await GenerateChat.findById(chatId);

        if (!chat) {
            res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
            return;
        }

        // Find the latest assistant message
        const assistantMessages = chat.messages.filter(msg => msg.role === 'assistant');

        if (assistantMessages.length === 0) {
            res.status(404).json({
                success: false,
                message: 'No assistant messages found to cancel'
            });
            return;
        }

        const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
        const messageIndex = chat.messages.findIndex(msg =>
            msg.role === 'assistant' &&
            msg.timestamp.getTime() === latestAssistantMessage.timestamp.getTime()
        );

        if (messageIndex === -1) {
            res.status(404).json({
                success: false,
                message: 'Assistant message not found in chat array'
            });
            return;
        }

        // Update the message properties directly instead of replacing the entire object
        chat.messages[messageIndex].completed = true;
        chat.messages[messageIndex].plannerOut = latestAssistantMessage.plannerOut || true;
        chat.messages[messageIndex].generatorOutput = latestAssistantMessage.generatorOutput || true;
        chat.messages[messageIndex].error = "cancelled";

        // Update content based on type
        if (typeof latestAssistantMessage.content === 'string') {
            chat.messages[messageIndex].content = 'Generation was cancelled by user.';
        } else {
            chat.messages[messageIndex].content = {
                plannerOutput: latestAssistantMessage.content.plannerOutput || '',
                llmResponse: latestAssistantMessage.content.llmResponse || 'Generation was cancelled by user.'
            };
        }

        // Mark the messages array as modified for Mongoose
        chat.markModified('messages');

        // Save the updated chat
        await chat.save();

        res.status(200).json({
            success: true,
            data: {
                chatId: chat._id,
                message: 'Generation cancelled successfully',
                updatedMessage: chat.messages[messageIndex]
            }
        });

    } catch (error) {
        console.error('Stop generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel generation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const completeGeneration = async (req: Request, res: Response) => {
    try {
        const { chatId, userId, projectId, isEdited } = req.body;

        if (!chatId || !userId) {
            res.status(400).json({
                success: false,
                message: 'Chat ID and User ID are required'
            });
            return;
        }

        // Fetch user
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }

        // Skip if test account
        if (user.isTestAccount) {
            console.log(`✓ Test account ${userId} - skipping credit deduction`);
            res.status(200).json({
                success: true,
                message: 'Completion recorded (test account)'
            });
            return;
        }

        // Deduct appropriate credit
        const creditField = isEdited ? 'credits.editing' : 'credits.generation';

        if (user.credits[isEdited ? 'editing' : 'generation'] <= 0) {
            console.warn(`⚠ User ${userId} has no ${isEdited ? 'editing' : 'generation'} credits`);
            res.status(200).json({
                success: true,
                message: 'No credits to deduct'
            });
            return;
        }

        // Atomic decrement
        const updateResult = await User.updateOne(
            {
                _id: userId,
                [creditField]: { $gt: 0 }
            },
            {
                $inc: { [creditField]: -1 }
            }
        );

        if (updateResult.modifiedCount > 0) {
            console.log(`✓ Deducted 1 ${isEdited ? 'editing' : 'generation'} credit from user ${userId}`);
            res.status(200).json({
                success: true,
                message: 'Credit deducted successfully',
                remainingCredits: {
                    generation: user.credits.generation - (isEdited ? 0 : 1),
                    editing: user.credits.editing - (isEdited ? 1 : 0)
                }
            });
        } else {
            console.warn(`⚠ Credit deduction failed for user ${userId} (race condition or insufficient credits)`);
            res.status(200).json({
                success: true,
                message: 'Credit deduction skipped'
            });
        }

    } catch (error) {
        console.error('Complete generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete generation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export const generateGuestChatResponse = async (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;

        if (!prompt?.trim()) {
            res.status(400).json({
                success: false,
                message: 'Prompt is required'
            });
            return;
        }

        // 1. Find or create guest user
        const guestEmail = 'guest@stitcher.com';
        let guestUser = await User.findOne({ email: guestEmail });

        if (!guestUser) {
            guestUser = new User({
                username: 'guest',
                email: guestEmail,
                password: 'guest_password_' + Date.now(), // Random password
                role: 'user',
                plan: 'free',
                credits: { generation: 1000, editing: 1000, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
            });
            await guestUser.save();
        }

        // 2. Find or create guest project
        let guestProject: any;
        if (guestUser.projects && guestUser.projects.length > 0) {
            guestProject = await Project.findById(guestUser.projects[0]);
        }

        if (!guestProject) {
            guestProject = new Project({
                name: 'Guest Project',
                status: 'draft',
                bytes: 0
            });
            await guestProject.save();

            // Link to user
            guestUser.projects = guestUser.projects || [];
            guestUser.projects.push(guestProject._id as Types.ObjectId);
            await guestUser.save();
        }

        // 3. Get API Keys (Borrow from valid user)
        let apiKeys: ApiKeyMapping;
        try {
            apiKeys = await fetchApiKeysForUser("68a89b21cbadb4fe13132d57");
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch API keys'
            });
            return;
        }

        // 4. Create Chat
        const chat = new GenerateChat({
            projectId: guestProject._id,
            messages: [],
            title: prompt.trim().substring(0, 50),
            userId: guestUser._id
        });

        const userMessage: IGenerateChatMessage = {
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            scenes: [],
            projectDescription: "",
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: "none",
            requestType: "generate",
            assetsToEdit: []
        };
        chat.messages.push(userMessage);

        const assistantMessage: IGenerateChatMessage = {
            role: 'assistant',
            content: {
                plannerOutput: "",
                llmResponse: ""
            },
            timestamp: new Date(),
            scenes: [],
            projectDescription: "",
            completed: false,
            plannerOut: false,
            generatorOutput: false,
            error: "none",
            requestType: undefined,
            assetsToEdit: []
        };
        chat.messages.push(assistantMessage);

        await chat.save();

        if (!guestProject.edit_chat) {
            guestProject.edit_chat = chat._id;
            await guestProject.save();
        }

        // 5. Call Microservice
        const microserviceResult = await callVideoGenerationMicroservice(
            prompt,
            "guest",
            guestProject._id.toString(),
            (guestUser._id as any).toString(),
            (chat._id as Types.ObjectId).toString(),
            apiKeys
        );

        if (microserviceResult.status === 'error') {
            res.status(503).json({
                success: false,
                message: 'Microservice is not reachable'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                chatId: chat._id,
                projectId: guestProject._id,
                userId: guestUser._id,
                message: 'Guest generation started'
            }
        });

    } catch (error) {
        console.error('Guest chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate guest chat',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}