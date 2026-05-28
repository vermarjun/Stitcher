import { Router } from "express";
import {
    createProject,
    getProjectsByUser,
    getProjectById,
    updateProject,
    deleteProject,
    getRecentProjectsByUser
} from "../controller/project.controller";
import {
    inviteCollaborator,
    listCollaborators,
    removeCollaborator,
    sharedWithMe,
} from "../controller/collab.controller";
import auth from "../middleware/auth.middleware";
import { refreshCredits } from "../middleware/refreshCredits.middleware";
import { requireProjectOwnership } from "../middleware/ownership.middleware";
import { requireProjectAccess } from "../middleware/access.middleware";

const router = Router();

// Create project for a user
router.post("/", auth, createProject);

// Get all projects for a user
router.get("/user/:userId", auth, getProjectsByUser);

// Get 2 projects for a user
router.get("/user/:userId", auth, getRecentProjectsByUser);

// Projects shared with the current user (must be before /:id to avoid param conflict)
router.get("/shared-with-me", auth, sharedWithMe);

// Get single project by ID — collaborators may read
router.get("/:id", auth, refreshCredits, getProjectById);

// Update project
router.put("/:id", auth, updateProject);

// Delete project (cascade delete) — owner-only
router.delete("/:id", auth, deleteProject);

// ─── Collaborator sub-routes ──────────────────────────────────────────────────

// Invite — owner-only
router.post(
    "/:projectId/invite",
    auth,
    requireProjectOwnership("params", "projectId"),
    inviteCollaborator
);

// List collaborators — owner or accepted collaborator
router.get(
    "/:projectId/collaborators",
    auth,
    requireProjectAccess("params", "projectId"),
    listCollaborators
);

// Remove collaborator — owner-only
router.delete(
    "/:projectId/collaborators/:collabUserId",
    auth,
    requireProjectOwnership("params", "projectId"),
    removeCollaborator
);

export default router;
