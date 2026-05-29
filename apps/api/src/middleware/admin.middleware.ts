/**
 * Admin gate for internal ops surfaces (live "god view", queue dashboards).
 *
 * Gating philosophy mirrors the bull-board mount in index.ts (OBSERVABILITY §5/§6):
 *   1. ADMIN_DASHBOARD_ENABLED must be "true" — the whole surface is off otherwise.
 *   2. The request must carry a valid JWT (runs `auth` first to populate req.userId).
 *   3. The authenticated user's role must be "admin".
 *
 * (1) + (2) match the existing bull-board stopgap; (3) tightens it now that an
 * admin role exists on the user model, so a merely-authenticated user can't reach
 * admin surfaces. Use `isAdminUser(userId)` to share the same check from the
 * Socket.IO `join_admin_live` handler.
 */

import { Request, Response, NextFunction } from "express";
import { ADMIN_DASHBOARD_ENABLED } from "../config";
import User from "../model/user.model";
import logger from "../util/logger.util";
import { Types } from "mongoose";

/**
 * Resolve whether a given userId belongs to an admin. Returns false on any
 * lookup failure or when the admin surface is disabled — never throws.
 */
export async function isAdminUser(userId: string | undefined): Promise<boolean> {
    if (!ADMIN_DASHBOARD_ENABLED) return false;
    if (!userId || !Types.ObjectId.isValid(userId)) return false;
    try {
        const user = await User.findById(userId).select("role").lean();
        // NOTE: IUser mistypes `role` as a schema-definition object, but the
        // stored value is the plain string "user" | "admin". Read it as such.
        const role = (user as { role?: unknown } | null)?.role;
        return role === "admin";
    } catch (err) {
        logger.warn({ message: "isAdminUser lookup failed", userId, error: String(err) });
        return false;
    }
}

/**
 * Express middleware that 404s the route unless the admin surface is enabled,
 * then 403s unless the authenticated user is an admin. Must be mounted AFTER the
 * `auth` middleware so `req.userId` is set.
 *
 * A 404 (not 403) is returned when the surface is disabled so its existence is
 * not advertised — consistent with requireFeature().
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!ADMIN_DASHBOARD_ENABLED) {
        return res.status(404).json({ error: { message: "Route not found" } });
    }
    const ok = await isAdminUser(req.userId);
    if (!ok) {
        logger.warn({ message: "requireAdmin denied", userId: req.userId });
        return res.status(403).json({ error: { message: "Admin access required" } });
    }
    next();
}
