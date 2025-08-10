import { Request, Response } from "express";
import Prompt from "../model/project.model";
import Scene from "../model/scene.model";

// Create a new prompt in a scene
export const createPrompt = async (req: Request, res: Response) => {
  try {
    const { sceneId } = req.params;
    const { code, prompt, metadata } = req.body;

    const scene = await Scene.findById(sceneId);
    if (!scene) {
      return res.status(404).json({ message: "Scene not found" });
    }

    const newPrompt = new Prompt({ code, prompt, metadata });
    await newPrompt.save();

    scene.prompts?.push(newPrompt._id as any);
    await scene.save();

    res.status(201).json(newPrompt);
  } catch (err) {
    res.status(500).json({ message: "Error creating prompt", error: err });
  }
};

// Get all prompts for a scene (sorted + paginated)
export const getPromptsByScene = async (req: Request, res: Response) => {
  try {
    const { sceneId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const scene = await Scene.findById(sceneId)
      .populate({
        path: "prompts",
        options: {
          sort: { createdAt: -1 }, // most recent first
          skip,
          limit
        }
      });

    if (!scene) {
      return res.status(404).json({ message: "Scene not found" });
    }

    // Count total prompts for pagination info
    const totalPrompts = await Prompt.countDocuments({ _id: { $in: scene.prompts } });

    res.json({
      page,
      limit,
      totalPrompts,
      totalPages: Math.ceil(totalPrompts / limit),
      prompts: scene.prompts
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching prompts", error: err });
  }
};

// Get a single prompt by ID
export const getPromptById = async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;
    const promptDoc = await Prompt.findById(promptId);
    if (!promptDoc) {
      return res.status(404).json({ message: "Prompt not found" });
    }
    res.json(promptDoc);
  } catch (err) {
    res.status(500).json({ message: "Error fetching prompt", error: err });
  }
};

// Update a prompt
export const updatePrompt = async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;
    const updated = await Prompt.findByIdAndUpdate(promptId, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Prompt not found" });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating prompt", error: err });
  }
};

// Delete a prompt
export const deletePrompt = async (req: Request, res: Response) => {
  try {
    const { sceneId, promptId } = req.params;

    const scene = await Scene.findById(sceneId);
    if (!scene) {
      return res.status(404).json({ message: "Scene not found" });
    }

    await Prompt.findByIdAndDelete(promptId);

    scene.prompts = scene.prompts?.filter(
      (id) => id.toString() !== promptId
    );
    await scene.save();

    res.json({ message: "Prompt deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting prompt", error: err });
  }
};

// Mark prompt as compiled
export const markPromptCompiled = async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;
    const promptDoc = await Prompt.findById(promptId);
    if (!promptDoc) {
      return res.status(404).json({ message: "Prompt not found" });
    }
    promptDoc.compiled = true;
    await promptDoc.save();

    res.json({ message: "Prompt marked as compiled", prompt: promptDoc });
  } catch (err) {
    res.status(500).json({ message: "Error marking prompt as compiled", error: err });
  }
};
