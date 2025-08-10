import { Router } from "express";
import {
    createScene,
    getScenesByProject,
    getSceneById,
    updateScene,
    deleteScene
} from "../controller/scene.controller";

const router = Router();

// Create scene for a project
router.post("/", createScene);

// Get all scenes for a project
router.get("/project/:projectId", getScenesByProject);

// Get single scene
router.get("/:id", getSceneById);

// Update scene
router.put("/:id", updateScene);

// Delete scene (cascade delete prompts)
router.delete("/:id", deleteScene);

export default router;
