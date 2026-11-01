import { Document, Schema, model } from "mongoose";
import type { EmailKind } from "../email/types";

export interface IEmailLog extends Document {
  kind: EmailKind;
  to: string;
  subject: string;
  provider: string;
  messageId?: string;
  status: "sent" | "failed";
  error?: string;
  attemptsMade: number;
  jobId?: string;
  sentAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    kind: { type: String, required: true, enum: ["welcome", "verify_email", "password_reset"] },
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    provider: { type: String, required: true },
    messageId: { type: String },
    status: { type: String, required: true, enum: ["sent", "failed"], index: true },
    error: { type: String },
    attemptsMade: { type: Number, default: 1 },
    jobId: { type: String },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

EmailLogSchema.index({ sentAt: -1 });
EmailLogSchema.index({ kind: 1, sentAt: -1 });

export const EmailLog = model<IEmailLog>("EmailLog", EmailLogSchema);
