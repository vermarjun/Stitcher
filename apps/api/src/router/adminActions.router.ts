/**
 * Admin actions router — §2c.
 *
 * Mounted at ${API_PREFIX}/admin/actions.
 * Double-gated: valid JWT (auth) + admin role (requireAdmin).
 */

import { Router } from "express";
import auth from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import {
    banUser,
    grantCredits,
    setRole,
    featurePost,
    removePost,
    getAudit,
} from "../controller/adminActions.controller";

const router = Router();

router.use(auth);
router.use(requireAdmin);

// POST /admin/actions/users/:id/ban
router.post("/users/:id/ban", banUser);

// POST /admin/actions/users/:id/credits
router.post("/users/:id/credits", grantCredits);

// POST /admin/actions/users/:id/role
router.post("/users/:id/role", setRole);

// POST /admin/actions/posts/:id/feature
router.post("/posts/:id/feature", featurePost);

// DELETE /admin/actions/posts/:id
router.delete("/posts/:id", removePost);

// GET /admin/actions/audit
router.get("/audit", getAudit);

export default router;
