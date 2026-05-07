/**
 * Progress event publisher for the video-generation pipeline.
 *
 * Events are published to Redis channel `chat:{chatId}`.
 * The existing redis.util.ts pSubscribe('chat:*') pattern catches these and
 * emits `chat_update` to the Socket.IO room named chatId, so the frontend
 * receives real-time progress without polling.
 *
 * publishProgress is fire-and-forget (non-fatal): if Redis is unavailable
 * during a job step, log and continue — never throw from here.
 */

import { pubClient } from "./connection";
import logger from "../util/logger.util";

// ─── Event type union ─────────────────────────────────────────────────────────

export type ProgressEventType =
    | "job_queued"
    | "planning"
    | "plan_complete"
    | "scene_started"
    | "scene_code_complete"
    | "scene_render_complete"
    | "scene_failed"
    | "concat_started"
    | "job_complete"
    | "job_failed"
    | "edit_started"
    | "edit_render_complete"
    | "edit_complete"
    | "edit_failed";

export interface ProgressEvent {
    type: ProgressEventType;
    phase: string;
    /** Arbitrary extra payload (scene index, error message, partial URLs, etc.) */
    data?: unknown;
    /** ISO timestamp; injected automatically. */
    ts?: string;
}

// ─── Publisher ────────────────────────────────────────────────────────────────

export function publishProgress(chatId: string, event: ProgressEvent): void {
    const payload: ProgressEvent = { ...event, ts: new Date().toISOString() };
    const channel = `chat:${chatId}`;

    pubClient
        .publish(channel, JSON.stringify(payload))
        .catch((err: unknown) => {
            logger.warn({ message: "publishProgress: Redis PUBLISH failed", chatId, error: String(err) });
        });
}
