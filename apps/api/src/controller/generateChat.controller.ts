import { Request, Response } from 'express';
import { Types } from 'mongoose';
import GenerateChat, { IGenerateChat, IGenerateChatMessage } from '../model/generateChat.model';
import Project from '../model/project.model';
import Asset, { AssetType, AssetOrigin } from '../model/asset.model';
// import { microserviceClient } from '../services/microserviceClient'; // need to implement this
import { startSession } from 'mongoose';

interface GenerateChatRequest {
    projectId: string;
    prompt: string;
    chatId?: string; // Optional, for existing chats
}

interface MicroserviceResponse {
    llmResponse: string;
    code: string;
    cloudinaryMetadata: {
        url: string;
        thumbnail: string;
        duration: number;
        width: number;
        height: number;
        bytes: number;
        publicId: string;
        [key: string]: any;
    };
}

interface ProjectDescriptionResponse {
    updatedProjectDescription: string;
}

export const generateChatResponse = async (req: Request, res: Response) => {
    const session = await startSession();
    session.startTransaction();

    try {
        const { projectId, prompt, chatId }: GenerateChatRequest = req.body;

        // Validation
        if (!projectId || !prompt?.trim()) {
            res.status(400).json({
                success: false,
                message: 'Project ID and prompt are required'
            });
            return;
        }

        // Verify project exists
        const project = await Project.findById(projectId).session(session);
        if (!project) {
            res.status(404).json({
                success: false,
                message: 'Project not found'
            });
            return;
        }

        // Get or create chat
        let chat: IGenerateChat | null;
        let isNewChat = false;

        if (chatId) {
            chat = await GenerateChat.findById(chatId).session(session);
            if (chat == null) {
                res.status(404).json({
                    success: false,
                    message: 'Chat not found'
                });
                return;
            }
        } else {
            // Agar chat id nahi bheji hai to come here:
            // Create new chat
            chat = new GenerateChat({
                projectId: new Types.ObjectId(projectId),
                messages: [],
                title: prompt.trim().substring(0,20)
            });
            isNewChat = true;
        }
        
        // Add user message to chat
        const userMessage: IGenerateChatMessage = {
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            projectDescription: ""
        };
        chat.messages.push(userMessage);
        
        // Get last assistant message's code (if exists) for microservice
        const lastAssistantMessage = chat.messages
        .filter(msg => msg.role === 'assistant')
        .pop();
        
        const lastCode = lastAssistantMessage?.code || '';

        // Step 2: Make microservice call for video generation
        const videoGenerationData = {
            lastCode: lastCode,
            prompt: prompt
        };
        
        // const microserviceResponse: MicroserviceResponse = await microserviceClient.generateVideo(
            //     videoGenerationData
            // );
            
            const microserviceResponse: MicroserviceResponse = {
                llmResponse: "Hey I have made the changes as you requested",
                code: "python code will come here",
                cloudinaryMetadata: {
                    url: "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756990356/ezgif-1c22e6dbdda273_frao3j.mp4",
                    thumbnail: "https://docs.manim.community/en/stable/_images/FixedInFrameMObjectTest-1.png",
                    duration: 13,
                    width: 1200,
                    height: 1000,
                    bytes: 128,
                    publicId: "public Id",
                }
            }

        // Step 3: Create new asset with video metadata
        const newAsset = new Asset({
            name: `Generated Video - ${new Date().toISOString()}`,
            type: AssetType.VIDEO,
            origin: AssetOrigin.GENERATED_VIDEO,
            url: microserviceResponse.cloudinaryMetadata.url,
            thumbnail: microserviceResponse.cloudinaryMetadata.thumbnail,
            duration: microserviceResponse.cloudinaryMetadata.duration,
            width: microserviceResponse.cloudinaryMetadata.width,
            height: microserviceResponse.cloudinaryMetadata.height,
            bytes: microserviceResponse.cloudinaryMetadata.bytes,
            metadata: microserviceResponse.cloudinaryMetadata,
            projectId: new Types.ObjectId(projectId),
            isOnTimeline: false
        });     

        await newAsset.save({ session });

        // Add assistant message to chat
        const assistantMessage: IGenerateChatMessage = {
            role: 'assistant',
            content: microserviceResponse.llmResponse,
            code: microserviceResponse.code,
            assetId: newAsset._id as Types.ObjectId,
            timestamp: new Date(),
            projectDescription: "" // Will be updated after next microservice call
        };
        chat.messages.push(assistantMessage);
        
        // Save chat
        await chat.save({ session });

        // Update project's edit_chat reference if it's a new chat
        if (isNewChat) {
            project.edit_chat = chat._id as Types.ObjectId;
            await project.save({ session });
        }

        // Step 4: Update project description
        const currentProjectDescription = project.project_script

        const projectDescriptionData = {
            currentProjectDescription,
            newLLMResponse: microserviceResponse.llmResponse
        };

        // const descriptionResponse: ProjectDescriptionResponse = await microserviceClient.updateProjectDescription(
        //     projectDescriptionData
        // );
        
        const descriptionResponse:ProjectDescriptionResponse = {
            updatedProjectDescription: "this is the newly updated project response"
        }

        // Update the assistant message with new project description
        const lastMessageIndex = chat.messages.length - 1;
        chat.messages[lastMessageIndex].projectDescription = descriptionResponse.updatedProjectDescription;
        await chat.save({ session });

        // Commit transaction
        await session.commitTransaction();

        // Step 5: Send response to frontend
        res.status(200).json({
            success: true,
            data: {
                llmResponse: microserviceResponse.llmResponse,
                asset: {
                    _id: newAsset._id,
                    name: newAsset.name,
                    type: newAsset.type,
                    url: newAsset.url,
                    thumbnail: newAsset.thumbnail,
                    duration: newAsset.duration,
                    width: newAsset.width,
                    height: newAsset.height,
                    metadata: newAsset.metadata
                },
                chatId: chat._id,
                projectDescription: descriptionResponse.updatedProjectDescription
            }
        });

    } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();

        console.error('Generate chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate chat response',
            error: error
        });
    } finally {
        session.endSession();
    }
}

// Get chat history
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;

        const chat = await GenerateChat.findById(chatId)
            .populate('messages.assetId')
            .lean();

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

// Rollback to a specific project description
export const rollbackToDescription = async (req: Request, res: Response) => {
    try {
        const { chatId, messageIndex } = req.body;

        if (typeof messageIndex !== 'number' || messageIndex < 0) {
            res.status(400).json({
                success: false,
                message: 'Valid message index is required'
            });
            return;
        }

        const chat = await GenerateChat.findById(chatId);
        if (!chat) {
            res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
            return;
        }

        if (messageIndex >= chat.messages.length) {
            res.status(400).json({
                success: false,
                message: 'Invalid message index'
            });
            return;
        }

        const selectedMessage = chat.messages[messageIndex];
        if (selectedMessage.role !== 'assistant') {
            res.status(400).json({
                success: false,
                message: 'Can only rollback to assistant messages'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                projectDescription: selectedMessage.projectDescription,
                code: selectedMessage.code,
                assetId: selectedMessage.assetId
            }
        });

    } catch (error) {
        console.error('Rollback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to rollback'
        });
    }
}