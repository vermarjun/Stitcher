/**
 * User long-term memory — management + test endpoints.
 *
 * Lets the authenticated user inspect and curate the preferences the system has
 * learned about them, and (for testing) trigger a reflect() pass directly so the
 * memory loop can be exercised without running a full video generation.
 */

import { Request, Response } from "express";
import {
    getMemory,
    recall,
    learn,
    update,
    forget,
    reflect,
} from "../services/memoryService";
import { isLlmConfigured } from "../util/llm.util";
import logger from "../util/logger.util";

// GET /api/memory — list the user's memory points (with ids).
export async function listMemory(req: Request, res: Response) {
    const userId = req.userId!;
    const memory = await getMemory(userId);
    return res.status(200).json({ memory, llmConfigured: isLlmConfigured() });
}

// POST /api/memory — manually add a memory point. Body: { text }
export async function addMemory(req: Request, res: Response) {
    const userId = req.userId!;
    const { text } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ message: "Body must include a non-empty 'text' string." });
    }
    await learn(userId, text);
    const memory = await getMemory(userId);
    return res.status(201).json({ memory });
}

// PATCH /api/memory/:id — manually rewrite a memory point. Body: { text }
export async function updateMemory(req: Request, res: Response) {
    const userId = req.userId!;
    const { id } = req.params;
    const { text } = req.body ?? {};
    if (!id) {
        return res.status(400).json({ message: "Missing memory id." });
    }
    if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ message: "Body must include a non-empty 'text' string." });
    }
    await update(userId, id, text);
    const memory = await getMemory(userId);
    return res.status(200).json({ memory });
}

// DELETE /api/memory/:id — forget a single memory point.
export async function deleteMemory(req: Request, res: Response) {
    const userId = req.userId!;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: "Missing memory id." });
    }
    await forget(userId, id);
    const memory = await getMemory(userId);
    return res.status(200).json({ memory });
}

// POST /api/memory/reflect — run a reflect() pass on a supplied turn (testing).
// Body: { userMessage, assistantMessage? }
export async function reflectMemory(req: Request, res: Response) {
    const userId = req.userId!;
    const { userMessage, assistantMessage } = req.body ?? {};
    if (typeof userMessage !== "string" || !userMessage.trim()) {
        return res.status(400).json({ message: "Body must include a non-empty 'userMessage' string." });
    }
    if (!isLlmConfigured()) {
        return res.status(503).json({ message: "LLM not configured (OPENCODE_GO_API_KEY missing)." });
    }

    const before = await recall(userId);
    const actions = await reflect(userId, {
        userMessage,
        assistantMessage: typeof assistantMessage === "string" ? assistantMessage : undefined,
    });
    const memory = await getMemory(userId);

    logger.info({ message: "[memory] reflect (test endpoint)", userId, actionCount: actions.length });
    return res.status(200).json({ before, actions, memory });
}
