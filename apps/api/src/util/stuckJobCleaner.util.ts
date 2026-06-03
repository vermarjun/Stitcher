/**
 * Stuck job cleaner — runs every 5 minutes.
 *
 * Finds GenerationJob rows stuck in an active status for longer than
 * STUCK_THRESHOLD_MS and marks them failed. This catches the scenario where
 * the BullMQ job was dropped (e.g. Redis eviction, crash) but the DB row
 * was never updated, which previously caused a LangGraph checkpointer to
 * retry the job indefinitely — burning API quota with each retry.
 *
 * Publishes a socket event for each stuck job so the UI updates.
 */

import GenerationJob from "../model/generationJob.model";
import { publishProgress } from "../queue/eventPublisher.util";
import logger from "./logger.util";

const STUCK_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes of NO progress
const POLL_INTERVAL_MS   =  5 * 60 * 1000; //  5 minutes

const ACTIVE_STATUSES = ["queued", "planning", "generating", "rendering", "concatenating"];

let cleanerHandle: ReturnType<typeof setInterval> | null = null;

async function cleanStuckJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    try {
        // Gate on updatedAt (last stage/progress write), NOT createdAt — a job
        // that is actively progressing (each stage bumps updatedAt) must never be
        // force-failed just because it has been running a while. Only jobs that
        // have made NO progress for the full threshold are considered stuck.
        const stuck = await GenerationJob.find({
            status: { $in: ACTIVE_STATUSES },
            updatedAt: { $lt: cutoff },
        }).select("_id chatId jobId status createdAt updatedAt").lean<Array<{
            _id: unknown; chatId: string; jobId: string; status: string; createdAt: Date; updatedAt: Date;
        }>>();

        if (stuck.length === 0) return;

        logger.warn({
            message: `[stuckJobCleaner] found ${stuck.length} stuck job(s) — marking failed`,
            ids: stuck.map((j) => j.jobId),
        });

        for (const job of stuck) {
            await GenerationJob.findByIdAndUpdate(job._id, {
                status: "failed",
                error: "stuck — exceeded 15-minute active threshold; cleaned up automatically",
                completedAt: new Date(),
            });

            // Notify the UI so the generate panel doesn't spin forever
            publishProgress(job.chatId, {
                type: "job_complete",
                phase: "failed",
                data: { status: "failed", finalUrl: null },
            });
        }
    } catch (err) {
        // Never crash the server — this is best-effort housekeeping
        logger.error({ message: "[stuckJobCleaner] tick failed", error: String(err) });
    }
}

export function startStuckJobCleaner(): void {
    if (cleanerHandle !== null) return;

    // Run one pass immediately on boot to clean any jobs left over from the
    // previous server run (e.g. after a crash or forced restart).
    void cleanStuckJobs();

    cleanerHandle = setInterval(() => void cleanStuckJobs(), POLL_INTERVAL_MS);
    if (cleanerHandle.unref) cleanerHandle.unref();

    logger.info({ message: "[stuckJobCleaner] started (5-minute interval, 15-minute threshold)" });
}

export function stopStuckJobCleaner(): void {
    if (cleanerHandle !== null) {
        clearInterval(cleanerHandle);
        cleanerHandle = null;
    }
}
