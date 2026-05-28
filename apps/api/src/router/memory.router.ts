import { Router } from "express";
import {
    listMemory,
    addMemory,
    updateMemory,
    deleteMemory,
    reflectMemory,
} from "../controller/memory.controller";
import auth from "../middleware/auth.middleware";

const router = Router();

// All memory routes are scoped to the authenticated user.
router.use(auth);

// GET    /api/memory          — list this user's learned memory
router.get("/", listMemory);

// POST   /api/memory          — manually add a memory point { text }
router.post("/", addMemory);

// POST   /api/memory/reflect  — run a reflect() pass on a turn { userMessage, assistantMessage? }
router.post("/reflect", reflectMemory);

// PATCH  /api/memory/:id      — manually rewrite a memory point { text }
router.patch("/:id", updateMemory);

// DELETE /api/memory/:id      — forget a single memory point
router.delete("/:id", deleteMemory);

export default router;
