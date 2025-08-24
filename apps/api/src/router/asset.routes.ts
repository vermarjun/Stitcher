import { Router } from "express";
import {
    createAsset,
    getAssets,
    getAssetById,
    getAssetsByOrigin,
    getAssetsByType,
    getAssetsStats,
    getAssetsByProject
} from "../controller/asset.controller";
import auth from "../middleware/auth.middleware";

const router = Router();

// Create project for a user
router.post("/", auth ,createAsset);

// Get all projects for a user
router.get("/user/:userId", auth, getProjectsByUser);

// Get 2 projects for a user
router.get("/user/:userId", auth, getRecentProjectsByUser);

// Get single project by ID
router.get("/:id", auth, getProjectById);

// Update project
router.put("/:id", auth, updateProject);

// Delete project (cascade delete)
router.delete("/:id", auth, deleteProject);

export default router;
