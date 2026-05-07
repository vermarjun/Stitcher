/**
 * editChat controller — v1 single-scene edit pipeline.
 *
 * POST /process
 *   Validates input, creates/finds the EditChat doc, appends the user message,
 *   enqueues a BullMQ edit job, and returns 202 immediately.  The worker
 *   (editWorker.ts) handles the actual RAG → code → render → asset flow.
 *
 * GET /history/:projectId
 *   Returns the EditChat message array for a project.
 *
 * POST /rollback
 *   v1: 501 stub.  Deep rollback (swap timeline item back to a previous asset)
 *   is deferred to v2.  When implemented, the rollback handler should look up
 *   the assistant message at the given index, retrieve the `newAssetId` stored
 *   in `message.content`, and call
 *   `TimelineItem.findByIdAndUpdate(timelineItemId, { assetId: oldAssetId })`.
 *   No snapshot/re-render needed — assets are immutable once created.
 */

import crypto from "crypto";
import { Request, Response } from "express";
import { Types } from "mongoose";
import Project from "../model/project.model";
import EditChat from "../model/editChat.model";
import { enqueueEdit } from "../queue/editQueue";
import { publishProgress } from "../queue/eventPublisher.util";

// ─── POST /process ────────────────────────────────────────────────────────────

export const processEditChat = async (req: Request, res: Response) => {
    const {
        projectId,
        assetId,
        editPrompt,
        timelineItemId,
        trackId,
    } = req.body as {
        projectId?: string;
        assetId?: string;
        editPrompt?: string;
        timelineItemId?: string;
        trackId?: string;
    };

    const userId = req.userId;

    // ── Validate required fields ─────────────────────────────────────────────
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ success: false, error: "Valid projectId is required" });
        return;
    }
    if (!assetId || !Types.ObjectId.isValid(assetId)) {
        res.status(400).json({ success: false, error: "Valid assetId is required" });
        return;
    }
    if (!editPrompt?.trim()) {
        res.status(400).json({ success: false, error: "editPrompt is required" });
        return;
    }
    if (!userId) {
        res.status(401).json({ success: false, error: "User not authenticated" });
        return;
    }

    // ── Verify project exists (ownership already enforced by middleware) ──────
    const project = await Project.findById(projectId);
    if (!project) {
        res.status(404).json({ success: false, error: "Project not found" });
        return;
    }

    // ── Get or create EditChat for this project ───────────────────────────────
    let editChat;
    if (project.edit_chat) {
        editChat = await EditChat.findById(project.edit_chat);
    }
    if (!editChat) {
        editChat = await EditChat.create({ messages: [] });
        project.edit_chat = editChat._id as Types.ObjectId;
        await project.save();
    }

    const editChatId = (editChat._id as Types.ObjectId).toString();

    // ── Append user message ───────────────────────────────────────────────────
    editChat.messages.push({
        role: "user",
        content: { editPrompt, assetId, timelineItemId },
        timestamp: new Date(),
        timelineObject: {},
    });
    await editChat.save();

    // ── Enqueue edit job ──────────────────────────────────────────────────────
    const traceId = (req as Request & { id?: string }).id ?? crypto.randomUUID();

    const jobId = await enqueueEdit({
        editChatId,
        userId,
        projectId,
        assetId,
        trackId,
        timelineItemId,
        editPrompt: editPrompt.trim(),
        traceId,
    });

    publishProgress(editChatId, { type: "job_queued", phase: "controller", data: { jobId } });

    res.status(202).json({
        success: true,
        data: { editChatId, jobId },
    });
};

// ─── GET /history/:projectId ──────────────────────────────────────────────────

export const getEditChatHistory = async (req: Request, res: Response) => {
    const { projectId } = req.params;

    if (!Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ success: false, error: "Invalid project ID format" });
        return;
    }

    const project = await Project.findById(projectId).populate("edit_chat");
    if (!project) {
        res.status(404).json({ success: false, error: "Project not found" });
        return;
    }

    if (!project.edit_chat) {
        res.json({ success: true, messages: [], chatId: null });
        return;
    }

    const editChat = await EditChat.findById(project.edit_chat);

    res.json({
        success: true,
        messages: editChat?.messages ?? [],
        chatId: editChat?._id ?? null,
    });
};

// ─── POST /rollback ───────────────────────────────────────────────────────────
// v1: not implemented.
//
// v2 plan:
//   - Accept { projectId, timelineItemId, messageIndex } in the body.
//   - Find the assistant message at messageIndex in the project's EditChat.
//   - Read message.content.newAssetId (the asset that was created by that edit).
//   - Call TimelineItem.findByIdAndUpdate(timelineItemId, { assetId: targetAssetId }).
//   - Assets are immutable; no re-render needed.

export const rollbackTimeline = async (_req: Request, res: Response) => {
    res.status(501).json({
        success: false,
        error: {
            message: "Rollback not yet implemented",
            code: "not_implemented",
        },
    });
};
