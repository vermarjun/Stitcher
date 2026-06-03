/**
 * AnalyticsEvent — lightweight product-analytics event stream.
 *
 * Powers the admin "user behaviour" insights: sessions, time-on-platform,
 * per-page/section engagement, DAU/WAU/MAU, retention and recurrent users.
 *
 * Ingested in batches via POST /api/analytics/collect (fire-and-forget from the
 * Client). One row per event. Raw events auto-expire after 120 days (TTL index);
 * aggregates the admin reads are computed on the fly from this collection.
 *
 * Design notes:
 *  - `userId` is null for pre-login / anonymous activity; `anonId` (a stable
 *    client-generated id in localStorage) ties anonymous + logged-in activity
 *    together and survives across sessions.
 *  - `sessionId` is per browser session (resets after ~30 min idle / new tab).
 *  - `durationMs` carries the active time accumulated since the previous
 *    heartbeat (type "heartbeat") or the whole session (type "session_end"),
 *    so summing durationMs per user/page yields real time-on-platform.
 */

import { Schema, model, Document, Types } from "mongoose";

export const ANALYTICS_EVENT_TYPES = [
    "page_view",   // a route/page was opened
    "heartbeat",   // periodic "still active" ping; durationMs = active ms since last beat
    "action",      // a discrete interaction (generate_click, export, rate, …)
    "session_end", // tab closed / went idle; durationMs = total active session ms
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export interface IAnalyticsEvent extends Document {
    userId: Types.ObjectId | null;
    anonId: string;
    sessionId: string;
    type: AnalyticsEventType;
    /** Normalised route, e.g. "/dashboard" (dynamic params stripped). */
    page: string;
    /** Logical section/feature, e.g. "generate" | "timeline" | "community". */
    section?: string;
    /** For type="action": the action name, e.g. "generate_click". */
    action?: string;
    /** Active milliseconds carried by heartbeat / session_end events. */
    durationMs?: number;
    /** Plan tier at event time (denormalised for cheap segment queries). */
    plan?: string;
    /** Free-form context (referrer, device, label, value…). Never trusted/large. */
    meta?: Record<string, unknown>;
    ts: Date;
    createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
    {
        userId:    { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
        anonId:    { type: String, required: true, index: true },
        sessionId: { type: String, required: true, index: true },
        type:      { type: String, enum: ANALYTICS_EVENT_TYPES, required: true },
        page:      { type: String, default: "" },
        section:   { type: String },
        action:    { type: String },
        durationMs:{ type: Number, default: 0, min: 0, max: 6 * 60 * 60 * 1000 }, // cap 6h sanity
        plan:      { type: String },
        meta:      { type: Schema.Types.Mixed },
        ts:        { type: Date, required: true, index: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for the admin aggregations.
AnalyticsEventSchema.index({ ts: 1, type: 1 });
AnalyticsEventSchema.index({ userId: 1, ts: 1 });
AnalyticsEventSchema.index({ page: 1, ts: 1 });

// TTL: auto-purge raw events after 120 days (aggregates are computed live).
AnalyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

const AnalyticsEvent = model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);
export default AnalyticsEvent;
