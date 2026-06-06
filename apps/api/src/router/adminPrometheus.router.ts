/**
 * Admin Prometheus Proxy Router — §2b of ADMIN_PORTAL_SPEC.md
 *
 * Mounted at ${API_PREFIX}/admin/prometheus.
 * Admin-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { proxyQuery, proxyQueryRange } from "../controller/adminPrometheus.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET /admin/prometheus/query?query=<promql>[&time=]
router.get("/query", proxyQuery);

// GET /admin/prometheus/query_range?query=&start=&end=&step=
router.get("/query_range", proxyQueryRange);

export default router;
