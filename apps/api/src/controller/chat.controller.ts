import { Request, Response } from "express";
import Chat from "../model/chat.model";
import Project from "../model/project.model";

// add message hi hai update delete nahi de raha mai abhi, there is no way to update/delete your prompt

// Add a new message to a chat
export const addChatMessage = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: "Message content is required" });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Add user message
        const userMessage = {
            role: 'user',
            content: content,
            timestamp: new Date(),
        };
        chat.messages.push(userMessage);

        // In a real implementation, LLM KO CALL LAGEGI with context
        const assistantMessage = {
            role: 'assistant',
            content: "This is a simulated response. In production, this would come from your LLM.",
            code: "", // Generated code would go here
            timestamp: new Date(),
            metadata: {}
        }; 


        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! TO DO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        // 1) fetch summary of this chat from chat model
        // 2) Use this summary as context for LLM
        // 3) Make a call to LLM
        // 4) LLM ke code ko microservice ko de
        // 5) Microservice is code ko render karke cloudinary ka metadata return karge
        // 6) Is returned metadata se asset add kar dunga ek naya
        // 7) Jo returned video hai wo video player me play ho jayegi automatically frontend pe

        // Add assistant response
        chat.messages.push(assistantMessage);

        await chat.save();

        res.status(201).json({
            userMessage,
            assistantMessage,
            chatId: chat._id
        });
    } catch (err) {
        res.status(500).json({ message: "Error adding chat message", error: err });
    }
};

// Get all messages for a chat
export const getChatMessages = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const chat = await Chat.findById(chatId)
            .slice('messages', [skip, limit])
            .sort({ 'messages.timestamp': -1 });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Get total message count for pagination
        const totalMessages = chat.messages.length;

        res.json({
            page,
            limit,
            totalMessages,
            totalPages: Math.ceil(totalMessages / limit),
            messages: chat.messages
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching chat messages", error: err });
    }
};
