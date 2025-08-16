import { Request, Response } from "express";
import Project from "../model/project.model";
import Chat from "../model/chat.model";
import User from "../model/user.model";
import mongoose from "mongoose";
import Timeline from "../model/timeline.model";
import Asset from "../model/asset.model";
import Track from "../model/track.model";
import TimelineItem from "../model/timelineitem.model";

// Create a new project for a user
export const createProject = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { userId, name } = req.body;

        if (!userId || !name) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "userId and name are required" });
        }

        // Create timeline first
        const timeline = new Timeline({
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            duration: 0
        });
        const savedTimeline = await timeline.save({ session });

        // Create project with timeline reference
        const project = new Project({ 
            name,
            timeline: savedTimeline._id,
            status: 'draft'
        });
        const savedProject = await project.save({ session });

        // Create a default chat for the project
        const chat = new Chat({
            name: "Main Chat",
            projectId: savedProject._id,
            status: 'idle'
        });
        await chat.save({ session });

        // Push project to user's projects array
        await User.findByIdAndUpdate(userId, {
            $push: { projects: savedProject._id }
        }, { session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            ...savedProject.toObject(),
            timeline: savedTimeline,
            chatId: chat._id
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Error creating project", error });
    }
};

// Get all projects for a user
export const getProjectsByUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate({
                path: "projects",
                populate: [
                    {
                        path: "timeline",
                        populate: {
                            path: "tracks",
                            populate: {
                                path: "items"
                            }
                        }
                    },
                    {
                        path: "chats" // Assuming you've added chats reference to Project model
                    }
                ]
            });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.projects);
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
            .populate("chats"); // Assuming you've added chats reference to Project model

        if (!project) return res.status(404).json({ message: "Project not found" });

        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({ message: "Error fetching project", error });
    }
};

// Update a project
export const updateProject = async (req: Request, res: Response) => {
    try {
        const updatedProject = await Project.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        if (!updatedProject) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.status(200).json(updatedProject);
    } catch (error) {
        res.status(500).json({ message: "Error updating project", error });
    }
};

// Delete a project with cascade delete
export const deleteProject = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        // Find the project and related data
        const project = await Project.findById(id).session(session);
        if (!project) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Project not found" });
        }

        // Find timeline and tracks
        const timeline = await Timeline.findOne({ projectId: id }).session(session);
        if (timeline) {
            const tracks = await Track.find({ timelineId: timeline._id }).session(session);
            
            // Delete all timeline items in tracks
            for (const track of tracks) {
                await TimelineItem.deleteMany({ trackId: track._id }).session(session);
            }
            
            // Delete tracks
            await Track.deleteMany({ timelineId: timeline._id }).session(session);
            
            // Delete timeline
            await Timeline.findByIdAndDelete(timeline._id).session(session);
        }

        // Delete chats
        await Chat.deleteMany({ projectId: id }).session(session);

        // Delete assets
        await Asset.deleteMany({ projectId: id }).session(session);

        // Delete project
        await Project.findByIdAndDelete(id).session(session);

        // Remove project from any user's projects array
        await User.updateMany(
            { projects: id },
            { $pull: { projects: id } }
        ).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Project and all related data deleted successfully" });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Error deleting project", error });
    }
};