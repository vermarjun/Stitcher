/**
 * Admin Metrics Router — §2b of ADMIN_PORTAL_SPEC.md
 *
 * Mounted at ${API_PREFIX}/admin/metrics.
 * Every route is double-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import {
    getOverview,
    getUsersMetrics,
    getUsersList,
    getGenerationsMetrics,
    getGenerationsList,
    getGenerationDetail,
    getContentMetrics,
    getRevenueMetrics,
    getCostMetrics,
} from "../controller/adminMetrics.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET /admin/metrics/overview
router.get("/overview", getOverview);

// GET /admin/metrics/users
router.get("/users", getUsersMetrics);

// GET /admin/metrics/users/list  (must be before /users/:something to avoid ambiguity)
router.get("/users/list", getUsersList);

// GET /admin/metrics/generations
router.get("/generations", getGenerationsMetrics);

// GET /admin/metrics/generations/list
router.get("/generations/list", getGenerationsList);

// GET /admin/metrics/generations/:jobId  (must come after /list)
router.get("/generations/:jobId", getGenerationDetail);

// GET /admin/metrics/content
router.get("/content", getContentMetrics);

// GET /admin/metrics/revenue
router.get("/revenue", getRevenueMetrics);

// GET /admin/metrics/cost
router.get("/cost", getCostMetrics);

export default router;
