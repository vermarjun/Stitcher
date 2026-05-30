/**
 * Admin health router — §2c.
 *
 * Mounted at ${API_PREFIX}/admin/health.
 * Double-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { getHealth } from "../controller/adminHealth.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET /admin/health
router.get("/", getHealth);

export default router;
