/**
 * Non-fatal lifecycle helpers for the GenerationJob history record (F2.4).
 *
 * Every helper here is fire-and-forget / swallow-on-error: a Mongo hiccup must
 * NEVER break a running generation or edit pipeline. Failures are logged at
 * warn level and otherwise ignored.
 *
 * These are deliberately coarse-grained — called on key transitions + per-scene
 * completion only — to keep DB write volume low.
 */

import { Types } from "mongoose";
import GenerationJob, {
    type GenerationJobQueue,
    type GenerationJobStatus,
    type IJobStage,
} from "../model/generationJob.model";
import { getPhaseMeta, type GenerationPhase } from "./pipelinePhases";
import logger from "../util/logger.util";

const MAX_PROMPT_LEN = 500;

function toObjectId(id?: string): Types.ObjectId | undefined {
    if (!id || !Types.ObjectId.isValid(id)) return undefined;
    return new Types.ObjectId(id);
}

/**
 * Create the history record at enqueue time. Returns nothing — callers should
 * not block on or await the result for correctness (it is awaited only so the
 * controller can swallow the error in its own try/catch).
 */
export async function createJobRecord(input: {
    jobId: string;
    queue: GenerationJobQueue;
    userId: string;
    projectId?: string;
    chatId?: string;
    prompt: string;
    traceId?: string;
}): Promise<void> {
    try {
        const q = getPhaseMeta("queued");
        await GenerationJob.create({
            jobId: input.jobId,
            queue: input.queue,
            userId: new Types.ObjectId(input.userId),
            projectId: toObjectId(input.projectId),
            chatId: toObjectId(input.chatId),
            prompt: (input.prompt ?? "").slice(0, MAX_PROMPT_LEN),
            status: "queued",
            sceneProgress: { done: 0, total: 0 },
            // Seed the live progress so a reload right after submit (before the
            // worker picks the job up) still shows "Waiting in queue…" at the floor.
            progress: { phase: "queued", label: q.label, percent: q.percent, ceil: q.ceil, updatedAt: new Date() },
            traceId: input.traceId,
            startedAt: new Date(),
        });
    } catch (err) {
        logger.warn({ message: "[jobTracker] createJobRecord failed (non-fatal)", jobId: input.jobId, error: String(err) });
    }
}

/** Coarse status transition. No-op on missing jobId / Mongo error. */
export async function setJobStatus(
    jobId: string | undefined,
    status: GenerationJobStatus,
    extra?: { finalUrl?: string; error?: string; completedAt?: Date }
): Promise<void> {
    if (!jobId) return;
    try {
        const update: Record<string, unknown> = { status };
        if (extra?.finalUrl !== undefined) update["finalUrl"] = extra.finalUrl;
        if (extra?.error !== undefined) update["error"] = extra.error;
        if (extra?.completedAt !== undefined) update["completedAt"] = extra.completedAt;
        await GenerationJob.updateOne({ jobId }, { $set: update });
    } catch (err) {
        logger.warn({ message: "[jobTracker] setJobStatus failed (non-fatal)", jobId, status, error: String(err) });
    }
}

/**
 * Persist the live granular progress (phase + label + percent + ceil) so a page
 * reload restores the exact bar position.
 *
 * MONOTONIC: the stored percentage never decreases. The debug→re-render loop
 * re-enters lower-numbered phases (render's floor is below debug's), but the bar
 * must not jump backward on reload — so the percent uses `$max` while the
 * phase/label/ceil always update (the label correctly flips to "Rendering…"
 * even while the percent holds at the debug high-water mark).
 *
 * Best-effort / non-fatal — a Mongo hiccup must never break a generation.
 */
export async function setJobProgress(
    jobId: string | undefined,
    phase: GenerationPhase
): Promise<void> {
    if (!jobId) return;
    try {
        const meta = getPhaseMeta(phase);
        await GenerationJob.updateOne(
            { jobId },
            {
                $max: { "progress.percent": meta.percent },
                $set: {
                    "progress.phase": phase,
                    "progress.label": meta.label,
                    "progress.ceil": meta.ceil,
                    "progress.updatedAt": new Date(),
                },
            }
        );
    } catch (err) {
        logger.warn({ message: "[jobTracker] setJobProgress failed (non-fatal)", jobId, phase, error: String(err) });
    }
}

/** Set the total scene count and move the job into the rendering phase. */
export async function setJobSceneTotal(jobId: string | undefined, total: number): Promise<void> {
    if (!jobId) return;
    try {
        await GenerationJob.updateOne(
            { jobId },
            { $set: { "sceneProgress.total": total, status: "rendering" } }
        );
    } catch (err) {
        logger.warn({ message: "[jobTracker] setJobSceneTotal failed (non-fatal)", jobId, error: String(err) });
    }
}

/** Increment the completed-scene counter by one. */
export async function incrementJobScene(jobId: string | undefined): Promise<void> {
    if (!jobId) return;
    try {
        await GenerationJob.updateOne({ jobId }, { $inc: { "sceneProgress.done": 1 } });
    } catch (err) {
        logger.warn({ message: "[jobTracker] incrementJobScene failed (non-fatal)", jobId, error: String(err) });
    }
}

/**
 * Push one stage row onto the job's `stages[]` array.
 *
 * Best-effort / non-fatal — a Mongo hiccup must never break a generation.
 */
export async function appendJobStage(
    jobId: string | undefined,
    stage: IJobStage
): Promise<void> {
    if (!jobId) return;
    try {
        await GenerationJob.updateOne({ jobId }, { $push: { stages: stage } });
    } catch (err) {
        logger.warn({ message: "[jobTracker] appendJobStage failed (non-fatal)", jobId, stage: stage.stage, error: String(err) });
    }
}

/**
 * Persist aggregated token counts and computed USD cost on the job record.
 *
 * Best-effort / non-fatal.
 */
export async function setJobTokens(
    jobId: string | undefined,
    tokens: { input: number; output: number; total: number },
    costUsd: number | null
): Promise<void> {
    if (!jobId) return;
    try {
        const update: Record<string, unknown> = {
            "tokens.input": tokens.input,
            "tokens.output": tokens.output,
        };
        if (costUsd !== null) {
            update["costUsd"] = costUsd;
        }
        await GenerationJob.updateOne({ jobId }, { $set: update });
    } catch (err) {
        logger.warn({ message: "[jobTracker] setJobTokens failed (non-fatal)", jobId, error: String(err) });
    }
}
