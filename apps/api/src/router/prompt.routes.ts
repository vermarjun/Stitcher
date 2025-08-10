import { Router } from "express";
import {
  createPrompt,
  getPromptsByScene,
  getPromptById,
  updatePrompt,
  deletePrompt,
  markPromptCompiled
} from "../controller/prompt.controller";

const router = Router();

// Create prompt in a scene
router.post("/:sceneId", createPrompt);

// Get all prompts for a scene
router.get("/scene/:sceneId", getPromptsByScene);

// Get single prompt
router.get("/:promptId", getPromptById);

// Update prompt
router.put("/:promptId", updatePrompt);

// Delete prompt
router.delete("/:sceneId/:promptId", deletePrompt);

// Mark as compiled
router.patch("/:promptId/compiled", markPromptCompiled);

export default router;
