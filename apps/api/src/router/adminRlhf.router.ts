/**
 * Admin RLHF Router — RLHF + LLM I/O visibility + coder memory endpoints.
 *
 * Mounted at ${API_PREFIX}/admin/rlhf.
 * Double-gated: valid JWT (auth) + admin role (requireAdmin).
 *
 * Routes:
 *   POST   /admin/rlhf/generations/:jobId/curate  — approve or reject for RAG
 *   POST   /admin/rlhf/rag/sync                   — sync pending candidates to RAG corpus
 *   GET    /admin/rlhf/generations/:jobId/llm-io  — full LLM I/O log for a job
 *   GET    /admin/rlhf/lessons                    — list all CoderLessons newest-first
 *   POST   /admin/rlhf/lessons                    — create a manual lesson
 *   PATCH  /admin/rlhf/lessons/:id                — edit a lesson's text
 *   DELETE /admin/rlhf/lessons/:id                — delete a lesson
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import {
    curateGeneration,
    syncRagCandidates,
    getGenerationLlmIO,
    listLessons,
    createLesson,
    updateLesson,
    deleteLesson,
} from "../controller/adminRlhf.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// POST /admin/rlhf/generations/:jobId/curate
router.post("/generations/:jobId/curate", curateGeneration);

// POST /admin/rlhf/rag/sync
router.post("/rag/sync", syncRagCandidates);

// GET /admin/rlhf/generations/:jobId/llm-io
router.get("/generations/:jobId/llm-io", getGenerationLlmIO);

// GET  /admin/rlhf/lessons
router.get("/lessons", listLessons);

// POST /admin/rlhf/lessons
router.post("/lessons", createLesson);

// PATCH /admin/rlhf/lessons/:id
router.patch("/lessons/:id", updateLesson);

// DELETE /admin/rlhf/lessons/:id
router.delete("/lessons/:id", deleteLesson);

export default router;
