/**
 * Admin actions controller — §2c Health+Actions.
 *
 * Each handler:
 *   1. Validates input.
 *   2. Locates the target (User or CommunityPost); 404 if missing.
 *   3. Applies the mutation.
 *   4. Writes an AdminAuditLog entry (adminId = req.userId, never fails the
 *      response if the audit write itself errors).
 *   5. Returns the success payload shape defined in §2c.
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../model/user.model";
import CommunityPost from "../model/communityPost.model";
import AdminAuditLog from "../model/adminAuditLog.model";
import logger from "../util/logger.util";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
}

async function writeAuditLog(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload: unknown
): Promise<void> {
    try {
        await AdminAuditLog.create({
            adminId: new mongoose.Types.ObjectId(adminId),
            action,
            targetType,
            targetId,
            payload,
        });
    } catch (err) {
        // Audit writes must never block the response.
        logger.error({ message: "adminAuditLog write failed", action, targetId, error: String(err) });
    }
}

// ─── POST /admin/actions/users/:id/ban ───────────────────────────────────────

/**
 * Ban or unban a user.
 * Body: { banned: boolean }
 * Sets isActive = !banned.
 * → { ok: true, user: { _id, isActive } }
 */
export async function banUser(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid user id" } });
        }

        const { banned } = req.body as { banned?: unknown };
        if (typeof banned !== "boolean") {
            return res.status(400).json({ error: { message: "banned must be a boolean" } });
        }

        const user = await User.findById(id).select("isActive");
        if (!user) {
            return res.status(404).json({ error: { message: "User not found" } });
        }

        user.isActive = !banned;
        await user.save();

        await writeAuditLog(req.userId!, "ban_user", "user", id, { banned });

        return res.status(200).json({ ok: true, user: { _id: user._id, isActive: user.isActive } });
    } catch (err) {
        logger.error({ message: "banUser failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update user" } });
    }
}

// ─── POST /admin/actions/users/:id/credits ───────────────────────────────────

/**
 * Grant or set credits for a user.
 * Body: { generation?: number, editing?: number, mode: 'set' | 'add' }
 * → { ok: true, credits: { generation, editing, expiresAt } }
 */
export async function grantCredits(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid user id" } });
        }

        const body = req.body as {
            generation?: unknown;
            editing?: unknown;
            mode?: unknown;
        };

        const mode = body.mode;
        if (mode !== "set" && mode !== "add") {
            return res.status(400).json({ error: { message: "mode must be 'set' or 'add'" } });
        }

        const genVal = body.generation !== undefined ? Number(body.generation) : undefined;
        const editVal = body.editing !== undefined ? Number(body.editing) : undefined;

        if (genVal !== undefined && (!Number.isFinite(genVal) || genVal < 0)) {
            return res.status(400).json({ error: { message: "generation must be a non-negative number" } });
        }
        if (editVal !== undefined && (!Number.isFinite(editVal) || editVal < 0)) {
            return res.status(400).json({ error: { message: "editing must be a non-negative number" } });
        }
        if (genVal === undefined && editVal === undefined) {
            return res.status(400).json({ error: { message: "at least one of generation or editing is required" } });
        }

        const user = await User.findById(id).select("credits");
        if (!user) {
            return res.status(404).json({ error: { message: "User not found" } });
        }

        if (mode === "set") {
            if (genVal !== undefined) user.credits.generation = genVal;
            if (editVal !== undefined) user.credits.editing = editVal;
        } else {
            // mode === 'add'
            if (genVal !== undefined) user.credits.generation += genVal;
            if (editVal !== undefined) user.credits.editing += editVal;
        }

        await user.save();

        await writeAuditLog(req.userId!, "grant_credits", "user", id, { generation: genVal, editing: editVal, mode });

        return res.status(200).json({ ok: true, credits: user.credits });
    } catch (err) {
        logger.error({ message: "grantCredits failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update credits" } });
    }
}

// ─── POST /admin/actions/users/:id/role ──────────────────────────────────────

/**
 * Set a user's role.
 * Body: { role: 'user' | 'admin' }
 * → { ok: true, role }
 */
export async function setRole(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid user id" } });
        }

        const { role } = req.body as { role?: unknown };
        if (role !== "user" && role !== "admin") {
            return res.status(400).json({ error: { message: "role must be 'user' or 'admin'" } });
        }

        const user = await User.findById(id).select("role");
        if (!user) {
            return res.status(404).json({ error: { message: "User not found" } });
        }

        // role field is typed oddly on IUser, but stored as plain string — cast via any.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (user as any).role = role;
        await user.save();

        await writeAuditLog(req.userId!, "set_role", "user", id, { role });

        return res.status(200).json({ ok: true, role });
    } catch (err) {
        logger.error({ message: "setRole failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update role" } });
    }
}

// ─── POST /admin/actions/posts/:id/feature ───────────────────────────────────

/**
 * Feature or unfeature a community post.
 * Body: { featured: boolean }
 * → { ok: true }
 */
export async function featurePost(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid post id" } });
        }

        const { featured } = req.body as { featured?: unknown };
        if (typeof featured !== "boolean") {
            return res.status(400).json({ error: { message: "featured must be a boolean" } });
        }

        const post = await CommunityPost.findById(id);
        if (!post) {
            return res.status(404).json({ error: { message: "Post not found" } });
        }

        // isFeatured field added by this agent (see communityPost.model.ts edit)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (post as any).isFeatured = featured;
        await post.save();

        await writeAuditLog(req.userId!, "feature_post", "post", id, { featured });

        return res.status(200).json({ ok: true });
    } catch (err) {
        logger.error({ message: "featurePost failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update post" } });
    }
}

// ─── DELETE /admin/actions/posts/:id ─────────────────────────────────────────

/**
 * Delete a community post.
 * → { ok: true }
 */
export async function removePost(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: { message: "Invalid post id" } });
        }

        const post = await CommunityPost.findByIdAndDelete(id);
        if (!post) {
            return res.status(404).json({ error: { message: "Post not found" } });
        }

        await writeAuditLog(req.userId!, "remove_post", "post", id, {});

        return res.status(200).json({ ok: true });
    } catch (err) {
        logger.error({ message: "removePost failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to delete post" } });
    }
}

// ─── GET /admin/actions/audit ─────────────────────────────────────────────────

/**
 * Paginated audit log.
 * Query: ?page=1&limit=20
 * → { entries, total, page, limit }
 */
export async function getAudit(req: Request, res: Response) {
    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
        const skip = (page - 1) * limit;

        const [entries, total] = await Promise.all([
            AdminAuditLog.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("adminId", "username email")
                .lean(),
            AdminAuditLog.countDocuments(),
        ]);

        return res.status(200).json({ entries, total, page, limit });
    } catch (err) {
        logger.error({ message: "getAudit failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to retrieve audit log" } });
    }
}
