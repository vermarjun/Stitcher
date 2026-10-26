import { Request, Response } from "express";
import Project from "../model/project.model";
import EditChat from "../model/editChat.model";
import User from "../model/user.model";
import mongoose from "mongoose";
import Timeline from "../model/timeline.model";
import Asset from "../model/asset.model";
import Track from "../model/track.model";
import TimelineItem from "../model/timelineitem.model";
import { Types } from "mongoose";
import { storage } from "../storage";

// Create a new project for a user.
// Writes run one after another (no multi-document transaction), so this works
// on a standalone MongoDB as well as a replica set. If a step fails, the
// documents created so far are removed.
export const createProject = async (req: Request, res: Response) => {
    const { name } = req.body;
    const userId = req.userId;
    if (!userId || !name) {
        return res.status(400).json({ message: "userId and name are required" });
    }

    const created: Array<{ model: { deleteOne: (f: object) => Promise<unknown> }; id: Types.ObjectId }> = [];
    try {
        const savedProject = await new Project({ name, status: 'draft' }).save();
        created.push({ model: Project, id: savedProject._id as Types.ObjectId });

        const timeline = await new Timeline({
            projectId: savedProject._id,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            duration: 0
        }).save();
        created.push({ model: Timeline, id: timeline._id as Types.ObjectId });

        // One track per type: video, audio, text
        for (const type of ['video', 'audio', 'text'] as const) {
            const track = await new Track({
                type,
                projectId: savedProject._id,
                timelineId: timeline._id,
                items: []
            }).save();
            created.push({ model: Track, id: track._id as Types.ObjectId });
            timeline.tracks.push(track._id as Types.ObjectId);
        }
        await timeline.save();

        const editChat = await new EditChat({ messages: [] }).save();
        created.push({ model: EditChat, id: editChat._id as Types.ObjectId });

        savedProject.timeline = timeline._id as mongoose.Types.ObjectId;
        savedProject.edit_chat = editChat._id as mongoose.Types.ObjectId;
        await savedProject.save();

        await User.findByIdAndUpdate(userId, { $push: { projects: savedProject._id } });

        res.status(201).json({
            ...savedProject.toObject(),
            timeline,
        });
    } catch (error) {
        for (const { model, id } of created.reverse()) {
            await model.deleteOne({ _id: id }).catch(() => undefined);
        }
        res.status(500).json({ message: "Error creating project", error });
    }
};

// Get all projects for a user
export const getProjectsByUser = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId)
            .populate({
                path: "projects",
                populate: [
                    {
                        path: "timeline",
                        populate: {
                            path: "tracks",
                            populate: {
                                path: 'items',
                                populate: {
                                    path: 'assetId'
                                }
                            }
                        }
                    },
                    {
                        path: "edit_chat", // Populate EditChat
                        select: "messages"
                    }
                ]
            });
        
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.projects ?? []);
    } catch (error) {
        res.status(500).json({ message: "Error fetching projects", error });
    }
};

// Get a single project by ID
export const getProjectById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate({
                path: "timeline",
                populate: {
                    path: "tracks",
                    populate: {
                        path: "items"
                    }
                }
            })
            .populate({
                path: "edit_chat", // Populate EditChat
                select: "messages" // Only select messages field
            });
            
        if (!project) return res.status(404).json({ message: "Project not found" });

        res.status(200).json(project.toObject());
    } catch (error) {
        res.status(500).json({ message: "Error fetching project", error });
    }
};

// Update a project
export const updateProject = async (req: Request, res: Response) => {
    try {
        // Only these fields can be edited from the client.
        const allowed = ["name", "project_script", "status", "playback_url", "preview_url", "bytes", "compiled"];
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (req.body?.[key] !== undefined) updates[key] = req.body[key];
        }
        const updatedProject = await Project.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true }
        )
        .populate({
            path: "edit_chat", // Populate EditChat in updated project
            select: "messages"
        });
        
        if (!updatedProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        
        res.status(200).json(updatedProject);
    } catch (error) {
        res.status(500).json({ message: "Error updating project", error });
    }
};

// Delete a project and everything that belongs to it.
// Sequential deletes, no transaction (see createProject).
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Timeline, tracks and items
        const timeline = await Timeline.findOne({ projectId: id });
        if (timeline) {
            const tracks = await Track.find({ timelineId: timeline._id });
            for (const track of tracks) {
                await TimelineItem.deleteMany({ trackId: track._id });
            }
            await Track.deleteMany({ timelineId: timeline._id });
            await Timeline.findByIdAndDelete(timeline._id);
        }

        // Edit chats
        if (project.edit_chat) {
            await EditChat.findByIdAndDelete(project.edit_chat);
        }

        // Assets and their stored files (best effort for the files)
        const assets = await Asset.find({ projectId: id }).select("url metadata").lean();
        for (const asset of assets) {
            const key: string | null = asset.metadata?.storageKey ?? storage.keyFromUrl(asset.url);
            if (key) await storage.remove(key).catch(() => undefined);
        }
        await Asset.deleteMany({ projectId: id });

        await Project.findByIdAndDelete(id);

        // Remove the project from the owner's list
        await User.updateMany({ projects: id }, { $pull: { projects: id } });

        res.status(200).json({ message: "Project and all related data deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting project", error });
    }
};
