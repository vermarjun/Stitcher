/**
 * AdminAuditLog — records every admin action taken via the /admin/actions routes.
 *
 * Fields:
 *   adminId    — ObjectId of the admin who performed the action (ref User).
 *   action     — String identifier, e.g. "ban_user", "grant_credits", "set_role",
 *                "feature_post", "remove_post".
 *   targetType — "user" | "post" | etc. — identifies what was acted on.
 *   targetId   — String representation of the target's _id.
 *   payload    — Mixed snapshot of the request body for audit trail.
 *   createdAt  — Timestamp.
 */

import { Schema, Document, Types, Model, model } from "mongoose";

export interface IAdminAuditLog extends Document {
    adminId: Types.ObjectId;
    action: string;
    targetType: string;
    targetId: string;
    payload?: unknown;
    createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
    {
        adminId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        action: { type: String, required: true },
        targetType: { type: String, required: true },
        targetId: { type: String, required: true },
        payload: { type: Schema.Types.Mixed },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Primary access pattern: newest entries first.
AdminAuditLogSchema.index({ createdAt: -1 });

const AdminAuditLog: Model<IAdminAuditLog> = model<IAdminAuditLog>(
    "AdminAuditLog",
    AdminAuditLogSchema
);

export default AdminAuditLog;
