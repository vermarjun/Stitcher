/**
 * Admin feedback router — list and manage user-submitted feedback.
 * Mounted at ${API_PREFIX}/admin/feedback.
 * Double-gated: valid JWT + admin role (via requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { listFeedback, updateFeedback } from "../controller/feedback.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// GET /admin/feedback — paginated list with counts
router.get("/", listFeedback);

// PATCH /admin/feedback/:id — update status / adminNote
router.patch("/:id", updateFeedback);

export default router;
