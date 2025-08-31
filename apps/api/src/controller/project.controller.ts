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
import path from "path";

// Create a new project for a user
export const createProject = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { name } = req.body;
        const userId = req.userId;
        if (!userId || !name) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "userId and name are required" });
        }
        
        // Create project first
        const project = new Project({ 
            name,
            status: 'draft'
        });
        const savedProject = await project.save({ session });
        
        // Create timeline with projectId reference
        const timeline = new Timeline({
            projectId: savedProject._id,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            duration: 0
        });
        const savedTimeline = await timeline.save({ session });
        
        // Update project with timeline reference
        savedProject.timeline = savedTimeline._id as mongoose.Types.ObjectId;
        await savedProject.save({ session });
        
        // Create video track 
        const videoTrack = new Track({
            type: 'video',
            projectId: savedProject._id,
            timelineId: savedTimeline._id,
            items: []
        });
        const savedVideoTrack = await videoTrack.save({ session });
        
        // Update timeline with video track reference
        timeline.tracks.push(savedVideoTrack._id as Types.ObjectId);
        await timeline.save({ session });
        
        // Create audio track
        const audioTrack = new Track({
            type: 'audio',
            projectId: savedProject._id,
            timelineId: savedTimeline._id,
            items: []
        });
        const savedAudioTrack = await audioTrack.save({ session });
        
        // Update timeline with audio track reference
        timeline.tracks.push(savedAudioTrack._id as Types.ObjectId);
        await timeline.save({ session });
        
        // Create text track
        const textTrack = new Track({
            type: 'text',
            projectId: savedProject._id,
            timelineId: savedTimeline._id,
            items: []
        });
        const savedTextTrack = await textTrack.save({ session });
        
        // Update timeline with text track reference
        timeline.tracks.push(savedTextTrack._id as Types.ObjectId);
        await timeline.save({ session });
        
        // Create EditChat instance
        const editChat = new EditChat({
            messages: []
        });
        const savedEditChat = await editChat.save({ session });
        
        // Update project with EditChat reference
        savedProject.edit_chat = savedEditChat._id as mongoose.Types.ObjectId;
        await savedProject.save({ session }); 
        
        // Push project to user's projects array
        await User.findByIdAndUpdate(userId, {
            $push: { projects: savedProject._id }
        }, { session });
        
        await session.commitTransaction();
        session.endSession();
        
        res.status(201).json({
            ...savedProject.toObject(),
            timeline: savedTimeline,
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
        
        res.status(200).json(user.projects);
    } catch (error) {
        res.status(500).json({ message: "Error fetching projects", error });
    }
};

// Get recent projects (last 2 projects updated by user)
export const getRecentProjectsByUser = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId)
            .populate({
                path: "projects",
                options: { 
                    sort: { updatedAt: -1 }, // Sort by most recently updated
                    limit: 2 // Only get 2 most recent projects
                },
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
                        path: "edit_chat", // Populate EditChat
                        select: "messages" // Only select messages field
                    }
                ]
            });
            
        if (!user) return res.status(404).json({ message: "User not found" });
        
        res.status(200).json(user.projects);
    } catch (error) {
        res.status(500).json({ message: "Error fetching recent projects", error });
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
        
        // Find timeline using projectId (one-to-one relationship)
        const timeline = await Timeline.findOne({ projectId: id }).session(session);
        if (timeline) {
            // Find tracks using timelineId
            const tracks = await Track.find({ timelineId: timeline._id }).session(session);
            
            // Delete all timeline items in tracks
            for (const track of tracks) {
                await TimelineItem.deleteMany({ trackId: track._id }).session(session);
            }
            
            // Delete tracks using timelineId
            await Track.deleteMany({ timelineId: timeline._id }).session(session);
            
            // Delete timeline
            await Timeline.findByIdAndDelete(timeline._id).session(session);
        }
        
        // Delete EditChat associated with the project
        if (project.edit_chat) {
            await EditChat.findByIdAndDelete(project.edit_chat).session(session);
        }
        
        // Delete assets using projectId
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