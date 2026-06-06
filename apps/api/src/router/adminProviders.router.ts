/**
 * Admin providers router — runtime per-tier provider config.
 *
 * Mounted at ${API_PREFIX}/admin/providers.
 * Double-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { listProviders, upsertProvider, testEmbedderKey } from "../controller/adminProviders.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET  /admin/providers         — list all configs (apiKey masked)
router.get("/", listProviders);

// POST /admin/providers/:service/test  — probe a provider key (embedder only)
router.post("/:service/test", testEmbedderKey);

// PUT  /admin/providers/:service/:tier  — upsert one cell
router.put("/:service/:tier", upsertProvider);

export default router;
