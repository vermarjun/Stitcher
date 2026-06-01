/**
 * Admin providers router — runtime per-tier provider config.
 *
 * Mounted at ${API_PREFIX}/admin/providers.
 * Double-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { listProviders, upsertProvider } from "../controller/adminProviders.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET  /admin/providers         — list all configs (apiKey masked)
router.get("/", listProviders);

// PUT  /admin/providers/:service/:tier  — upsert one cell
router.put("/:service/:tier", upsertProvider);

export default router;
