import { Request, Response } from "express";
import Project from "../model/project.model";
import Scene from "../model/scene.model";
import Prompt from "../model/prompt.model";
import User from "../model/user.model";
import mongoose from "mongoose";

// Create a new project for a user
export const createProject = async (req: Request, res: Response) => {
    try {
        const { userId, name } = req.body;

        if (!userId || !name) {
            return res.status(400).json({ message: "userId and name are required" });
        }

        // Create project
        const project = new Project({ name });
        const savedProject = await project.save();

        // Push project to user's projects array
        await User.findByIdAndUpdate(userId, {
            $push: { projects: savedProject._id }
        });

        res.status(201).json(savedProject);
    } catch (error) {
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
                populate: {
                    path: "scenes",
                    populate: { path: "prompts" }
                }
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
                path: "scenes",
                populate: { path: "prompts" }
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

        // Find the project
        const project = await Project.findById(id).populate("scenes");

        if (!project) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Project not found" });
        }

        // Delete prompts in all scenes
        const sceneIds = project.scenes?.map((s: any) => s._id) || [];
        for (const sceneId of sceneIds) {
            const scene = await Scene.findById(sceneId).populate("prompts");
            if (scene && scene.prompts) {
                await Prompt.deleteMany({ _id: { $in: scene.prompts } }).session(session);
            }
        }

        // Delete scenes
        await Scene.deleteMany({ _id: { $in: sceneIds } }).session(session);

        // Delete project
        await Project.findByIdAndDelete(id).session(session);

        // Remove project from any user's projects array
        await User.updateMany(
            { projects: id },
            { $pull: { projects: id } }
        ).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Project and related data deleted successfully" });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Error deleting project", error });
    }
};
