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
 *   Given { projectId, messageId, timelineItemId }, finds the assistant message
 *   with that _id in the project's EditChat, reads its content.previousAssetId,
 *   restores that assetId on the TimelineItem, and appends a system message.
 *   Assets are immutable; no re-render is needed.
 */

import crypto from "crypto";
import { Request, Response } from "express";
import { Types } from "mongoose";
import Project from "../model/project.model";
import EditChat from "../model/editChat.model";
import TimelineItem from "../model/timelineitem.model";
import Asset from "../model/asset.model";
import { enqueueEdit } from "../queue/editQueue";
import { publishProgress } from "../queue/eventPublisher.util";
import { createJobRecord } from "../queue/jobTracker.util";

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

    // ── Verify project exists (access already enforced by middleware) ─────────
    const project = await Project.findById(projectId);
    if (!project) {
        res.status(404).json({ success: false, error: "Project not found" });
        return;
    }

    // The asset must belong to this project.
    const sourceAsset = await Asset.exists({ _id: assetId, projectId: new Types.ObjectId(projectId) });
    if (!sourceAsset) {
        res.status(404).json({ success: false, error: "Asset not found in this project" });
        return;
    }

    // ── Get or create THIS USER's private EditChat for this project ───────────
    // Edit chats are per-user: userId === req.userId.
    let editChat = await EditChat.findOne({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
    });
    if (!editChat) {
        editChat = await EditChat.create({
            projectId: new Types.ObjectId(projectId),
            userId: new Types.ObjectId(userId),
            messages: [],
        });
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

    // Record the edit job in the user's generation history (F2.4). Non-fatal.
    await createJobRecord({
        jobId,
        queue: "edit",
        userId,
        projectId,
        chatId: editChatId,
        prompt: editPrompt.trim(),
        traceId,
    }).catch(() => undefined);

    publishProgress(editChatId, { type: "job_queued", phase: "controller", data: { jobId } });

    res.status(202).json({
        success: true,
        data: { editChatId, jobId },
    });
};

// ─── GET /history/:projectId ──────────────────────────────────────────────────

export const getEditChatHistory = async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ success: false, error: "Invalid project ID format" });
        return;
    }
    if (!userId) {
        res.status(401).json({ success: false, error: "User not authenticated" });
        return;
    }

    // Return only THIS user's private edit chat for the project.
    const editChat = await EditChat.findOne({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
    });

    res.json({
        success: true,
        messages: editChat?.messages ?? [],
        chatId: editChat?._id ?? null,
    });
};

// ─── POST /rollback ───────────────────────────────────────────────────────────
//
// Body: { projectId, messageId, timelineItemId }
//   messageId        — the _id of the assistant EditChat message that recorded
//                      the edit we want to undo. message.content.previousAssetId
//                      is the asset to restore.
//   timelineItemId   — the TimelineItem whose assetId should be rolled back.
//
// Assets are immutable once created; no re-render is needed.

export const rollbackTimeline = async (req: Request, res: Response) => {
    const {
        projectId,
        messageId,
        timelineItemId,
    } = req.body as {
        projectId?: string;
        messageId?: string;
        timelineItemId?: string;
    };

    const userId = req.userId;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!userId) {
        res.status(401).json({ success: false, error: "User not authenticated" });
        return;
    }
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ success: false, error: "Valid projectId is required" });
        return;
    }
    // messageId is a numeric array index (messages have _id: false in the schema)
    if (messageId === undefined || messageId === null || String(messageId).trim() === "") {
        res.status(400).json({ success: false, error: "messageId is required" });
        return;
    }
    if (!timelineItemId || !Types.ObjectId.isValid(timelineItemId)) {
        res.status(400).json({ success: false, error: "Valid timelineItemId is required" });
        return;
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    // Projects have no explicit ownerId field visible in the schema but the
    // middleware already enforces ownership for most routes.  We re-confirm
    // by ensuring the project exists.  If your schema adds an `owner` field
    // later, add: if (String(project.owner) !== userId) { 403 }
    const project = await Project.findById(projectId);
    if (!project) {
        res.status(404).json({ success: false, error: "Project not found" });
        return;
    }

    // ── Load THIS user's private EditChat ─────────────────────────────────────
    const editChat = await EditChat.findOne({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
    });
    if (!editChat) {
        res.status(404).json({ success: false, error: "No edit chat found for you on this project" });
        return;
    }

    // ── Find the target message ───────────────────────────────────────────────
    // ChatMessageSchema has _id: false, so messages don't have Mongoose _id.
    // We stored messageId as the message index stringified or as content.messageId.
    // The worker appends assistant messages with content that may include
    // previousAssetId. We find by matching messageId against message content.
    //
    // Since the schema has _id: false, we match by a `messageId` field that the
    // worker stores in the message content, falling back to index-as-id.
    const msgIndex = editChat.messages.findIndex(
        (m) =>
            m.role === "assistant" &&
            m.content != null &&
            (
                // Match a stored messageId field
                (typeof m.content === "object" && String(m.content.messageId) === messageId) ||
                // Or treat the messageId as a numeric index (legacy)
                (String(editChat.messages.indexOf(m)) === messageId)
            )
    );

    // If no match by content.messageId, try treating messageId as an array index
    const byIndex = !isNaN(Number(messageId)) ? Number(messageId) : -1;
    const resolvedIndex =
        msgIndex !== -1
            ? msgIndex
            : byIndex >= 0 && byIndex < editChat.messages.length
              ? byIndex
              : -1;

    if (resolvedIndex === -1) {
        res.status(404).json({ success: false, error: "Message not found in this project's edit chat" });
        return;
    }

    const targetMessage = editChat.messages[resolvedIndex];

    // ── Extract previousAssetId ───────────────────────────────────────────────
    const content = targetMessage?.content as Record<string, unknown> | undefined;
    const previousAssetId = content?.previousAssetId as string | undefined;

    if (!previousAssetId || !Types.ObjectId.isValid(previousAssetId)) {
        res.status(422).json({
            success: false,
            error: "This message does not record a previousAssetId — cannot roll back",
        });
        return;
    }

    // ── Restore the timeline item ─────────────────────────────────────────────
    const updated = await TimelineItem.findByIdAndUpdate(
        timelineItemId,
        { assetId: new Types.ObjectId(previousAssetId) },
        { new: true }
    );

    if (!updated) {
        res.status(404).json({ success: false, error: "TimelineItem not found" });
        return;
    }

    // ── Append a system note to the chat ──────────────────────────────────────
    const editNumber = resolvedIndex + 1;
    editChat.messages.push({
        role: "assistant",
        content: {
            system: true,
            action: "rollback",
            restoredAssetId: previousAssetId,
            fromMessageIndex: resolvedIndex,
            note: `Rolled back edit #${editNumber}`,
        },
        timestamp: new Date(),
        timelineObject: {},
    });
    await editChat.save();

    res.status(200).json({
        success: true,
        data: {
            restoredAssetId: previousAssetId,
            timelineItemId,
            note: `Rolled back edit #${editNumber}`,
        },
    });
};
