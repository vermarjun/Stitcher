/**
 * Feedback controller — handles user-submitted feedback (bugs, ideas, other)
 * and admin management of that feedback.
 *
 * Public (auth-only) routes:
 *   POST /feedback  — submitFeedback
 *
 * Admin routes:
 *   GET  /admin/feedback       — listFeedback
 *   PATCH /admin/feedback/:id  — updateFeedback
 */

import { Request, Response } from "express";
import Feedback, { IFeedback } from "../model/feedback.model";
import logger from "../util/logger.util";
import { Types } from "mongoose";

const VALID_TYPES = ["Bug", "Idea", "Other"] as const;
const VALID_STATUSES = ["new", "triaged", "resolved"] as const;

type FeedbackType = (typeof VALID_TYPES)[number];
type FeedbackStatus = (typeof VALID_STATUSES)[number];

/**
 * POST /feedback
 * Any authenticated user can submit feedback.
 */
export async function submitFeedback(req: Request, res: Response) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: { message: "Unauthorized" } });
        }

        const { type, message } = req.body as { type?: unknown; message?: unknown };

        if (!type || !VALID_TYPES.includes(type as FeedbackType)) {
            return res
                .status(400)
                .json({ error: { message: `type must be one of: ${VALID_TYPES.join(", ")}` } });
        }

        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return res.status(400).json({ error: { message: "message is required" } });
        }

        if (message.length > 5000) {
            return res
                .status(400)
                .json({ error: { message: "message must be 5000 characters or fewer" } });
        }

        const feedback = await Feedback.create({
            userId: new Types.ObjectId(userId),
            type: type as FeedbackType,
            message: message.trim(),
        });

        return res.status(201).json({
            feedback: {
                _id: feedback._id,
                type: feedback.type,
                message: feedback.message,
                status: feedback.status,
                createdAt: (feedback as IFeedback).createdAt,
            },
        });
    } catch (err) {
        logger.error({ message: "submitFeedback failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to submit feedback" } });
    }
}

/**
 * GET /admin/feedback?status=&type=&page=1&limit=20
 * Admin: paginated list with overall counts.
 */
export async function listFeedback(req: Request, res: Response) {
    try {
        const status = req.query.status as string | undefined;
        const type = req.query.type as string | undefined;
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
        const skip = (page - 1) * limit;

        // Build filter for paginated query
        const filter: Record<string, unknown> = {};
        if (status && VALID_STATUSES.includes(status as FeedbackStatus)) {
            filter.status = status;
        }
        if (type && VALID_TYPES.includes(type as FeedbackType)) {
            filter.type = type;
        }

        const [feedbackDocs, total, countsAgg] = await Promise.all([
            Feedback.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate<{ userId: { _id: Types.ObjectId; username: string; email: string } | null }>(
                    "userId",
                    "_id username email"
                )
                .lean(),
            Feedback.countDocuments(filter),
            // Overall counts (not filtered) for the byType/byStatus panels
            Feedback.aggregate([
                {
                    $facet: {
                        byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
                        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                    },
                },
            ]),
        ]);

        // Flatten aggregation results to fixed-key objects
        const rawByType: { _id: string; count: number }[] =
            countsAgg[0]?.byType ?? [];
        const rawByStatus: { _id: string; count: number }[] =
            countsAgg[0]?.byStatus ?? [];

        const byType = {
            Bug: 0,
            Idea: 0,
            Other: 0,
            ...Object.fromEntries(rawByType.map((r) => [r._id, r.count])),
        } as { Bug: number; Idea: number; Other: number };

        const byStatus = {
            new: 0,
            triaged: 0,
            resolved: 0,
            ...Object.fromEntries(rawByStatus.map((r) => [r._id, r.count])),
        } as { new: number; triaged: number; resolved: number };

        // Map to FeedbackItem shape
        const feedbackItems = feedbackDocs.map((doc) => {
            const user = doc.userId as
                | { _id: Types.ObjectId; username: string; email: string }
                | null;
            const item: Record<string, unknown> = {
                _id: doc._id,
                user: user ? { _id: user._id, username: user.username, email: user.email } : null,
                type: doc.type,
                message: doc.message,
                status: doc.status,
                createdAt: doc.createdAt,
            };
            if (doc.adminNote !== undefined) item.adminNote = doc.adminNote;
            if (doc.resolvedAt !== undefined) item.resolvedAt = doc.resolvedAt;
            return item;
        });

        return res.status(200).json({
            feedback: feedbackItems,
            total,
            page,
            limit,
            counts: { byType, byStatus },
        });
    } catch (err) {
        logger.error({ message: "listFeedback failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to list feedback" } });
    }
}

/**
 * PATCH /admin/feedback/:id
 * Admin: update status and/or adminNote. Sets resolvedAt when status→resolved;
 * clears resolvedAt when moving away from resolved.
 */
export async function updateFeedback(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: { message: "Invalid feedback id" } });
        }

        const { status, adminNote } = req.body as {
            status?: unknown;
            adminNote?: unknown;
        };

        if (status !== undefined && !VALID_STATUSES.includes(status as FeedbackStatus)) {
            return res
                .status(400)
                .json({ error: { message: `status must be one of: ${VALID_STATUSES.join(", ")}` } });
        }

        const update: Record<string, unknown> = {};
        const unset: Record<string, unknown> = {};

        if (status !== undefined) {
            update.status = status as FeedbackStatus;
            if (status === "resolved") {
                update.resolvedAt = new Date();
            } else {
                unset.resolvedAt = "";
            }
        }

        if (adminNote !== undefined) {
            if (typeof adminNote !== "string") {
                return res.status(400).json({ error: { message: "adminNote must be a string" } });
            }
            update.adminNote = adminNote;
        }

        const updateOp: Record<string, unknown> = {};
        if (Object.keys(update).length > 0) updateOp.$set = update;
        if (Object.keys(unset).length > 0) updateOp.$unset = unset;

        if (Object.keys(updateOp).length === 0) {
            return res.status(400).json({ error: { message: "Nothing to update" } });
        }

        const updated = await Feedback.findByIdAndUpdate(id, updateOp, { new: true })
            .populate<{ userId: { _id: Types.ObjectId; username: string; email: string } | null }>(
                "userId",
                "_id username email"
            )
            .lean();

        if (!updated) {
            return res.status(404).json({ error: { message: "Feedback not found" } });
        }

        const user = updated.userId as
            | { _id: Types.ObjectId; username: string; email: string }
            | null;

        const feedbackItem: Record<string, unknown> = {
            _id: updated._id,
            user: user ? { _id: user._id, username: user.username, email: user.email } : null,
            type: updated.type,
            message: updated.message,
            status: updated.status,
            createdAt: updated.createdAt,
        };
        if (updated.adminNote !== undefined) feedbackItem.adminNote = updated.adminNote;
        if (updated.resolvedAt !== undefined) feedbackItem.resolvedAt = updated.resolvedAt;

        return res.status(200).json({ feedback: feedbackItem });
    } catch (err) {
        logger.error({ message: "updateFeedback failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update feedback" } });
    }
}
