/**
 * Public analytics ingestion router.
 *
 * Mounted at ${API_PREFIX} → POST /api/analytics/collect.
 * NO auth middleware: events come from both anonymous and logged-in clients;
 * the controller best-effort decodes the Bearer token to attach userId.
 */

import { Router } from "express";
import { collectAnalytics } from "../controller/analytics.controller";

const router = Router();

router.post("/analytics/collect", collectAnalytics);

export default router;
