/**
 * Admin live "god view" — REST snapshot of in-flight jobs (OBSERVABILITY §5).
 *
 * Returns the active + waiting jobs across the generation and edit BullMQ queues
 * so the /admin/live dashboard can seed its grid on load. The Socket.IO firehose
 * (`admin:live` room, see redis.util.ts + index.ts) then keeps the grid live.
 *
 * This is read-only: it only reads BullMQ state, never mutates a job. All
 * gating is handled by requireAdmin upstream in the router.
 */

import { Request, Response } from "express";
import type { Job, Queue } from "bullmq";
import { generationQueue } from "../queue/generationQueue";
import { editQueue } from "../queue/editQueue";
import logger from "../util/logger.util";

const PROMPT_TRUNCATE = 200;

interface LiveJobSnapshot {
    queue: string;
    jobId: string;
    chatId: string;
    userId: string;
    /** Truncated user prompt / edit instruction for display. */
    prompt: string;
    state: string;
    attemptsMade: number;
    /** Epoch ms when the job was created / enqueued. */
    timestamp: number | null;
    /** Epoch ms when processing began (null while still waiting). */
    processedOn: number | null;
    /** UUID correlation id threaded through the pipeline. */
    traceId?: string;
}

function truncate(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.length > PROMPT_TRUNCATE ? `${value.slice(0, PROMPT_TRUNCATE)}…` : value;
}

/**
 * Map a BullMQ job to the snapshot shape. The two queues use different payload
 * field names (chatId/prompt vs editChatId/editPrompt), so normalise both here.
 */
async function toSnapshot(job: Job, queueLabel: string): Promise<LiveJobSnapshot> {
    const data = (job.data ?? {}) as Record<string, unknown>;
    let state = "unknown";
    try {
        state = await job.getState();
    } catch {
        // Best-effort; leave as "unknown" if Redis hiccups.
    }

    const chatId = (data.chatId as string) ?? (data.editChatId as string) ?? "";
    const promptSource = (data.prompt as string) ?? (data.editPrompt as string) ?? "";

    return {
        queue: queueLabel,
        jobId: job.id ?? "",
        chatId,
        userId: (data.userId as string) ?? "",
        prompt: truncate(promptSource),
        state,
        attemptsMade: job.attemptsMade ?? 0,
        timestamp: job.timestamp ?? null,
        processedOn: job.processedOn ?? null,
        traceId: typeof data.traceId === "string" ? data.traceId : undefined,
    };
}

async function collectQueueJobs(queue: Queue, label: string): Promise<LiveJobSnapshot[]> {
    // active = currently processing, waiting = enqueued and not yet picked up.
    // delayed jobs (backoff retries) are included so a retrying job still shows.
    const jobs = await queue.getJobs(["active", "waiting", "delayed"], 0, 199, false);
    const snapshots = await Promise.all(jobs.map((j) => toSnapshot(j, label)));
    return snapshots;
}

/**
 * GET ${API_PREFIX}/admin/live/jobs
 * Returns { jobs: LiveJobSnapshot[] } across both pipelines, newest first.
 */
export async function listLiveJobs(_req: Request, res: Response) {
    try {
        const [generation, edit] = await Promise.all([
            collectQueueJobs(generationQueue, "video-generation"),
            collectQueueJobs(editQueue, "video-edit"),
        ]);

        const jobs = [...generation, ...edit].sort(
            (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
        );

        return res.status(200).json({ jobs, count: jobs.length });
    } catch (err) {
        logger.error({ message: "listLiveJobs failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to read queue snapshot" } });
    }
}
