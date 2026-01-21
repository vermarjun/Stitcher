// import { Request, Response } from "express";
// import Project from "../model/project.model";
// import Chat from "../model/chat.model";
// import User from "../model/user.model";
// import mongoose from "mongoose";

// // Search chats by keywords (searches through chat messages)
// export const searchChats = async (req: Request, res: Response) => {
//     try {
//         const { userId, projectId, q, type } = req.query;
        
//         if (!q) {
//             return res.status(400).json({ error: "Missing search query" });
//         }

//         const query = (q as string).toLowerCase();
//         let searchFilter: any = {};

//         // Filter by chat type if provided
//         if (type) {
//             if (!['generate', 'edit'].includes(type as string)) {
//                 return res.status(400).json({ error: "Invalid chat type. Must be 'generate' or 'edit'" });
//             }
//             searchFilter.type = type;
//         }

//         // If userId is provided, search within user's projects
//         if (userId) {
//             if (!mongoose.Types.ObjectId.isValid(userId as string)) {
//                 return res.status(400).json({ error: "Invalid userId" });
//             }

//             const user = await User.findById(userId).populate('projects');
//             if (!user) {
//                 return res.status(404).json({ error: "User not found" });
//             }

//             const projectIds = (user.projects as any[]).map(p => p._id);
//             searchFilter.projectId = { $in: projectIds };
//         }

//         // If projectId is provided, search within specific project
//         if (projectId) {
//             if (!mongoose.Types.ObjectId.isValid(projectId as string)) {
//                 return res.status(400).json({ error: "Invalid projectId" });
//             }
//             searchFilter.projectId = projectId;
//         }

//         // Search in chat messages content and chat names
//         // const chats = await Chat.find({
//         //     ...searchFilter,
//         //     $or: [
//         //         { name: { $regex: query, $options: 'i' } },
//         //         { 'messages.content': { $regex: query, $options: 'i' } },
//         //         { summary: { $regex: query, $options: 'i' } }
//         //     ]
//         // })
//         // .populate('projectId', 'name')
//         // .sort({ updatedAt: -1 })
//         // .limit(10);

//         const chats:any = []

//         // Filter and highlight matching messages
//         const searchResults = chats.map(chat => {
//             const matchingMessages = chat.messages.filter(msg => {
//                 // Handle both string and object content
//                 const contentStr = typeof msg.content === 'string' 
//                     ? msg.content 
//                     : JSON.stringify(msg.content);
//                 return contentStr.toLowerCase().includes(query);
//             });

//             return {
//                 _id: chat._id,
//                 name: chat.name,
//                 type: chat.type, // Include chat type
//                 projectId: chat.projectId,
//                 summary: chat.summary,
//                 compiled: chat.compiled,
//                 assetId: chat.assetId,
//                 matchingMessages: matchingMessages.slice(0, 3), // Top 3 matching messages
//                 totalMatches: matchingMessages.length,
//             };
//         });

//         res.json(searchResults);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Internal server error" });
//     }
// };

// // Search projects by name
// export const searchProjects = async (req: Request, res: Response) => {
//     try {
//         const { userId, q } = req.query;
        
//         if (!q) {
//             return res.status(400).json({ error: "Missing search query" });
//         }

//         const query = (q as string).toLowerCase();
//         let searchFilter: any = {};

//         // If userId is provided, search within user's projects only
//         if (userId) {
//             if (!mongoose.Types.ObjectId.isValid(userId as string)) {
//                 return res.status(400).json({ error: "Invalid userId" });
//             }

//             const user = await User.findById(userId).populate('projects');
//             if (!user) {
//                 return res.status(404).json({ error: "User not found" });
//             }

//             const projectIds = (user.projects as any[]).map(p => p._id);
//             searchFilter._id = { $in: projectIds };
//         }

//         // Search projects by name
//         const projects = await Project.find({
//             ...searchFilter,
//             name: { $regex: query, $options: 'i' }
//         })
//         .populate('timeline')
//         .populate('chats', 'name')
//         .sort({ updatedAt: -1 })
//         .limit(10);

//         res.json(projects);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "Internal server error" });
//     }
// };