/**
 * Feedback router — public (auth-only) route for submitting feedback.
 * Mounted at ${API_PREFIX}/feedback.
 * Admin routes live in adminFeedback.router.ts.
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { submitFeedback } from "../controller/feedback.controller";

const router = Router();

// All routes here require a valid JWT (any logged-in user, not just admins).
router.use(auth);

// POST /feedback — submit new feedback
router.post("/", submitFeedback);

export default router;
