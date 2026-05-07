/**
 * BullMQ Queue singleton for the video-edit pipeline.
 *
 * defaultJobOptions:
 *   attempts: 3        — total attempts including the first
 *   backoff exponential 5 s — doubles each retry (5 s, 10 s, 20 s)
 *   removeOnComplete: 100  — keep last 100 completed jobs for debugging
 *   removeOnFail: 500      — keep last 500 failed jobs for post-mortem
 */

import { Queue } from "bullmq";
import { redisConnection } from "./connection";
import type { EditJobData } from "./editTypes";

export const editQueue = new Queue<EditJobData>("video-edit", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

/**
 * Enqueue a video edit job and return the BullMQ job ID.
 * Throws if the queue is unreachable.
 */
export async function enqueueEdit(data: EditJobData): Promise<string> {
    const job = await editQueue.add("edit", data);
    return job.id ?? "";
}
