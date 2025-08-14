import { Request, Response } from "express";
import Project from "../model/project.model";
import mongoose from "mongoose";

export const searchPrompts = async (req: Request, res: Response) => {
    try {
        const { projectId, q } = req.query;

        if (!projectId || !q) {
            return res.status(400).json({ error: "Missing projectId or search query" });
        }

        if (!mongoose.Types.ObjectId.isValid(projectId as string)) {
            return res.status(400).json({ error: "Invalid projectId" });
        }

        const project = await Project.findById(projectId)
            .populate({
                path: "scenes",
                populate: {
                    path: "prompts",
                    model: "Prompt"
                }
            });

        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        if (!project.scenes) {
            return res.status(404).json({ error: "No Scene found for this project" });
        }

        // !!! FIX THIS CRAP
        // FUCKING STUPID APPRAOCH, WOULD BE STUPID FOR LARGE DB, CAN WORK FOR MVP I'LL FIX THIS LATER

        const allPrompts = project.scenes.flatMap((scene: any) => scene.prompts);

        const query = (q as string).toLowerCase();
        const filteredPrompts = allPrompts.filter((p: any) =>
            p.prompt.toLowerCase().includes(query)
        );

        const top3Prompts = filteredPrompts
            .sort((a: any, b: any) => b.createdAt - a.createdAt)
            .slice(0, 3);

        res.json(top3Prompts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};
