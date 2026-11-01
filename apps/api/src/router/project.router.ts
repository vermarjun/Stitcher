import { Router } from "express";
import {
    createProject,
    getProjectsByUser,
    getProjectById,
    updateProject,
    deleteProject,
} from "../controller/project.controller";
import auth from "../middleware/auth.middleware";
import { requireProjectOwnership } from "../middleware/ownership.middleware";

const router = Router();

// Create project for a user
router.post("/", auth, createProject);

// Get all projects for a user
router.get("/user/:userId", auth, getProjectsByUser);

// Get single project by ID (owner only)
router.get("/:id", auth, requireProjectOwnership("params", "id"), getProjectById);

// Update project
router.put("/:id", auth, requireProjectOwnership("params", "id"), updateProject);

// Delete project (cascade delete, owner only)
router.delete("/:id", auth, requireProjectOwnership("params", "id"), deleteProject);

export default router;
