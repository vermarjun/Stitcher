/**
 * BullMQ Queue singleton for the video-generation pipeline.
 *
 * defaultJobOptions:
 *   attempts: 3        — total attempts including the first
 *   backoff exponential 5 s — doubles each retry (5 s, 10 s, 20 s)
 *   removeOnComplete: 100  — keep last 100 completed jobs for debugging
 *   removeOnFail: 500      — keep last 500 failed jobs for post-mortem
 */

import { Queue } from "bullmq";
import { context, propagation } from "@opentelemetry/api";
import { redisConnection } from "./connection";
import type { VideoGenerationJobData } from "./types";

export const generationQueue = new Queue<VideoGenerationJobData>("video-generation", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

/**
 * Enqueue a video generation job and return the BullMQ job ID.
 * Throws if the queue is unreachable.
 */
export async function enqueueGeneration(data: VideoGenerationJobData): Promise<string> {
    // OBSERVABILITY §3a: inject the active W3C trace context into the job so the
    // worker can make its spans children of the originating request trace.
    const otelCarrier: Record<string, string> = {};
    propagation.inject(context.active(), otelCarrier);
    const job = await generationQueue.add("generate", { ...data, otelCarrier });
    return job.id ?? "";
}
