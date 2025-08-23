import { Router } from "express";
import {
    createProject,
    getProjectsByUser,
    getProjectById,
    updateProject,
    deleteProject,
    getRecentProjectsByUser
} from "../controller/project.controller";

const router = Router();

// Create project for a user
router.post("/", createProject);

// Get all projects for a user
router.get("/user/:userId", getProjectsByUser);

// Get 2 projects for a user
router.get("/user/:userId", getRecentProjectsByUser);

// Get single project by ID
router.get("/:id", getProjectById);

// Update project
router.put("/:id", updateProject);

// Delete project (cascade delete)
router.delete("/:id", deleteProject);

export default router;
