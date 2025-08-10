import { Request, Response } from "express";
import mongoose, {Types} from "mongoose";
import Scene from "../model/scene.model";
import Project from "../model/project.model";
import Prompt from "../model/prompt.model";

// Create a scene and link to a project
export const createScene = async (req: Request, res: Response) => {
    try {
        const { projectId, name } = req.body;

        if (!projectId || !name) {
            return res.status(400).json({ message: "projectId and name are required" });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Parent project not found" });
        }

        const scene = new Scene({ name });
        const savedScene = await scene.save();

        // Link scene to project
        project.scenes = [...(project.scenes || []), savedScene._id as Types.ObjectId];
        await project.save();

        res.status(201).json(savedScene);
    } catch (error) {
        res.status(500).json({ message: "Error creating scene", error });
    }
};

// Get all scenes of a project
export const getScenesByProject = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const project = await Project.findById(projectId).populate({
            path: "scenes",
            populate: { path: "prompts" }
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.status(200).json(project.scenes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching scenes", error });
    }
};

// Get a single scene
export const getSceneById = async (req: Request, res: Response) => {
    try {
        const scene = await Scene.findById(req.params.id).populate("prompts");
        if (!scene) {
            return res.status(404).json({ message: "Scene not found" });
        }
        res.status(200).json(scene);
    } catch (error) {
        res.status(500).json({ message: "Error fetching scene", error });
    }
};

// Update a scene
export const updateScene = async (req: Request, res: Response) => {
    try {
        const updatedScene = await Scene.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!updatedScene) {
            return res.status(404).json({ message: "Scene not found" });
        }
        res.status(200).json(updatedScene);
    } catch (error) {
        res.status(500).json({ message: "Error updating scene", error });
    }
};

// Delete a scene and cascade delete prompts
export const deleteScene = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const scene = await Scene.findById(id).populate("prompts");
        if (!scene) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Scene not found" });
        }

        // Delete prompts in scene
        const promptIds = scene.prompts?.map((p: any) => p._id) || [];
        if (promptIds.length > 0) {
            await Prompt.deleteMany({ _id: { $in: promptIds } }).session(session);
        }

        // Remove scene from any project that contains it
        await Project.updateMany(
            { scenes: id },
            { $pull: { scenes: id } }
        ).session(session);

        // Delete the scene itself
        await Scene.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Scene and related prompts deleted successfully" });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Error deleting scene", error });
    }
};
