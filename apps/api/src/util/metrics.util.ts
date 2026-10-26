/**
 * OpenTelemetry metric instruments and a periodic BullMQ queue-depth sampler.
 *
 * Instruments:
 *   - stitcher.pipeline.step.duration (histogram, ms)  attrs { step, success }
 *   - stitcher.queue.depth (gauge via async callback)  attrs { queue, state }
 *   - stitcher.render.concurrency (gauge)              attrs { }
 *
 * Instruments are obtained from the global MeterProvider, which is set up by
 * instrumentation.ts BEFORE this module is imported. If telemetry failed to
 * start, getMeter() returns a no-op meter, so every call here is safe.
 */

import { metrics, type ObservableResult } from "@opentelemetry/api";
import type { Queue } from "bullmq";
import logger from "./logger.util";

const meter = metrics.getMeter("stitcher-api", "0.1.0");

// ─── §3d: pipeline step duration histogram ──────────────────────────────────

/**
 * Records how long each pipeline step takes, in milliseconds, with
 * { step, success } attributes so Grafana can chart p50/p95 per step.
 */
export const pipelineStepDuration = meter.createHistogram(
    "stitcher.pipeline.step.duration",
    {
        description: "Duration of a single generation/edit pipeline step",
        unit: "ms",
    }
);

/**
 * Helper: time `fn`, record its duration into the histogram tagged with the
 * step name and success flag, then re-throw on error so control flow is
 * unchanged. Additive — callers may also wrap a span around this.
 */
export async function recordStep<T>(
    step: string,
    fn: () => Promise<T>,
    extraAttrs: Record<string, string | number | boolean> = {}
): Promise<T> {
    const start = Date.now();
    let success = false;
    try {
        const result = await fn();
        success = true;
        return result;
    } finally {
        pipelineStepDuration.record(Date.now() - start, {
            step,
            success,
            ...extraAttrs,
        });
    }
}

// ─── §3d: render concurrency gauge (best-effort) ────────────────────────────

let renderConcurrency = 0;

/** Bump the in-flight render counter (called around renderClient.render). */
export function incRenderConcurrency(): void {
    renderConcurrency++;
}
export function decRenderConcurrency(): void {
    renderConcurrency = Math.max(0, renderConcurrency - 1);
}

const renderConcurrencyGauge = meter.createObservableGauge(
    "stitcher.render.concurrency",
    { description: "Number of render calls currently in flight from the API" }
);
renderConcurrencyGauge.addCallback((result: ObservableResult) => {
    result.observe(renderConcurrency);
});

// ─── §3d: queue depth gauge (BullMQ getJobCounts) ───────────────────────────

interface NamedQueue {
    queue: Queue;
    /** Label used as the `queue` attribute (e.g. "video-generation"). */
    label: string;
}

let sampledQueues: NamedQueue[] = [];
// Cache of the most recent counts so the async gauge callback is non-blocking.
// (Observable callbacks should be cheap and synchronous-ish.)
let latestCounts: Array<{ label: string; counts: Record<string, number> }> = [];
let samplerTimer: NodeJS.Timeout | undefined;

const queueDepthGauge = meter.createObservableGauge("stitcher.queue.depth", {
    description: "BullMQ job counts per queue and state",
});
queueDepthGauge.addCallback((result: ObservableResult) => {
    for (const { label, counts } of latestCounts) {
        for (const [state, value] of Object.entries(counts)) {
            result.observe(value, { queue: label, state });
        }
    }
});

async function refreshQueueCounts(): Promise<void> {
    const next: Array<{ label: string; counts: Record<string, number> }> = [];
    for (const { queue, label } of sampledQueues) {
        try {
            const counts = await queue.getJobCounts();
            next.push({ label, counts: counts as Record<string, number> });
        } catch (err) {
            // Redis hiccup — keep the previous sample rather than crash.
            logger.debug({
                message: "[metrics] queue count sample failed",
                queue: label,
                error: String(err),
            });
        }
    }
    if (next.length > 0) latestCounts = next;
}

/**
 * Start sampling BullMQ job counts every `intervalMs` (default 10s) for the
 * supplied queues. Safe to call once at boot; idempotent (clears any prior
 * timer). The timer is unref'd so it never keeps the process alive.
 */
export function startQueueDepthSampler(
    queues: NamedQueue[],
    intervalMs = 10_000
): void {
    sampledQueues = queues;
    if (samplerTimer) clearInterval(samplerTimer);
    // Prime an immediate sample, then poll.
    void refreshQueueCounts();
    samplerTimer = setInterval(() => {
        void refreshQueueCounts();
    }, intervalMs);
    samplerTimer.unref();
}

/** Stop the sampler (used on graceful shutdown). */
export function stopQueueDepthSampler(): void {
    if (samplerTimer) {
        clearInterval(samplerTimer);
        samplerTimer = undefined;
    }
}

export { meter };
