/**
 * Admin live "god view" router (OBSERVABILITY §5).
 *
 * Mounted at ${API_PREFIX}/admin/live. Every route is double-gated:
 *   auth          — valid JWT (populates req.userId)
 *   requireAdmin  — ADMIN_DASHBOARD_ENABLED=true AND req.userId is an admin
 *
 * Kept OUT of the requireFeature("community") block — this is an internal ops
 * surface, not a community feature.
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { listLiveJobs } from "../controller/adminLive.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET /admin/live/jobs — snapshot of active/waiting jobs to seed the dashboard.
router.get("/jobs", listLiveJobs);

export default router;
