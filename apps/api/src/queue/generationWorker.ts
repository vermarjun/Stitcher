/**
 * BullMQ worker for the video-generation pipeline.
 *
 * Pipeline steps per job:
 *   1. Fail-fast credit check (avoids burning LLM quota on credit-less users)
 *   2. RAG enhance — grounded prompt + retrieval context
 *   3. Agent plan  — scenes[], styleManifest
 *   4. Per-scene (Promise.all with concurrency cap = 3):
 *        a. RAG enhance per scene
 *        b. Agent code — Manim Python code
 *        c. Render — mp4 URL from render service
 *        d. On render failure: Agent debug → re-render (up to 2 attempts/scene)
 *        e. Persist Asset in Mongo on success
 *   5. ffmpeg concat all mp4s → Cloudinary upload
 *   6. Update GenerateChat doc (finalUrl, status)
 *   7. Decrement user.credits.generation
 *   8. Best-effort RAG corpus storage
 *
 * Concurrency cap rationale: each scene render is CPU/GPU-bound on the render
 * service.  Cap at 3 to avoid saturating a single render-service instance
 * (which typically exposes maxConcurrent=3 in its semaphore).  Tune via env
 * WORKER_SCENE_CONCURRENCY if needed.
 *
 * Per-scene render failure handling:
 *   - render.success === false  → agent.debug() → render again (budget = 2)
 *   - ServiceError (503)        → surface to BullMQ (job-level retry)
 *   - All scenes failed         → throw, BullMQ will retry the whole job
 *
 * Worker concurrency = 4: four simultaneous jobs can run on this process.
 * lockDuration = 600 s: each job may take up to 10 minutes (render is slow).
 */

import { Worker, Job } from "bullmq";
import { Types } from "mongoose";
import { redisConnection } from "./connection";
import { ragClient } from "../services/ragClient";
import { agentClient } from "../services/agentClient";
import { renderClient } from "../services/renderClient";
import { ServiceError } from "../services/ServiceError";
import { resolveModelConfig } from "./modelConfig.util";
import { publishProgress } from "./eventPublisher.util";
import { concatVideos, uploadConcatToCloudinary } from "../util/ffmpegConcat.util";
import GenerateChat from "../model/generateChat.model";
import Asset, { AssetType, AssetOrigin } from "../model/asset.model";
import User from "../model/user.model";
import logger from "../util/logger.util";
import { AppError } from "../util/AppError";
import type {
    VideoGenerationJobData,
    VideoGenerationJobResult,
    ResolvedModelConfig,
} from "./types";
import type { SceneSpec, StyleManifest } from "../services/agentClient";

// ─── Inline p-limit helper ────────────────────────────────────────────────────
// We inline a simple concurrency limiter rather than adding a dependency.
// This avoids ESM/CJS compatibility issues with the p-limit npm package
// (which ships as pure ESM from v4 onward) while keeping the codebase strict.

function makeLimiter(maxConcurrent: number) {
    let running = 0;
    const queue: Array<() => void> = [];

    return function limit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const attempt = () => {
                running++;
                fn()
                    .then(resolve, reject)
                    .finally(() => {
                        running--;
                        if (queue.length > 0) {
                            const next = queue.shift();
                            if (next) next();
                        }
                    });
            };

            if (running < maxConcurrent) {
                attempt();
            } else {
                queue.push(attempt);
            }
        });
    };
}

// ─── Per-scene state ──────────────────────────────────────────────────────────

interface SceneState {
    sceneIndex: number;
    sceneSpec: SceneSpec;
    sceneClass: string;
    code: string;
    attempts: number; // render + debug-retry counter (max 2)
    status: "pending" | "success" | "failed";
    renderUrl?: string;
    assetId?: string;
    durationSec?: number;
    error?: string;
}

// ─── Worker process function ──────────────────────────────────────────────────

const SCENE_CONCURRENCY = parseInt(process.env["WORKER_SCENE_CONCURRENCY"] ?? "3", 10);
const MAX_RENDER_ATTEMPTS = 2;

async function processGenerationJob(
    job: Job<VideoGenerationJobData, VideoGenerationJobResult>
): Promise<VideoGenerationJobResult> {
    const { chatId, userId, projectId, prompt, traceId, modelConfigOverride, generationOptions } =
        job.data;

    // ── Step 0: Update job progress helper ──────────────────────────────────
    const progress = (type: Parameters<typeof publishProgress>[1]["type"], phase: string, data?: unknown) => {
        publishProgress(chatId, { type, phase, data });
        logger.debug({ message: `[worker] ${type}`, chatId, traceId, phase });
    };

    // ── Step 1: Credit check ─────────────────────────────────────────────────
    const user = await User.findById(userId).select("credits isTestAccount").lean();
    if (!user) {
        throw new AppError(404, `User ${userId} not found`, "user_not_found");
    }
    if (!user.isTestAccount && user.credits.generation <= 0) {
        throw new AppError(402, "Insufficient generation credits", "insufficient_credits");
    }

    // ── Step 2: Resolve model config ─────────────────────────────────────────
    const modelConfig: ResolvedModelConfig = await resolveModelConfig(userId, modelConfigOverride);

    // ── Step 3: RAG enhance (top-level prompt) ───────────────────────────────
    progress("planning", "rag_enhance");
    let groundedPrompt = prompt;

    try {
        const ragResult = await ragClient.enhance({ prompt }, traceId);
        groundedPrompt = ragResult.groundedPrompt;
    } catch (err) {
        // RAG is best-effort at planning stage; proceed with raw prompt
        logger.warn({ message: "[worker] RAG enhance (top-level) failed; using raw prompt", traceId, error: String(err) });
    }

    // ── Step 4: Agent plan ───────────────────────────────────────────────────
    progress("planning", "agent_plan");
    const planResponse = await agentClient.plan(
        {
            prompt: groundedPrompt,
            modelConfig: { planner: modelConfig.planner },
            constraints: {
                minScenes: generationOptions?.minScenes,
                maxScenes: generationOptions?.maxScenes,
                targetTotalDurationSec: generationOptions?.targetTotalDurationSec,
                renderQualityHint: generationOptions?.quality,
            },
            meta: { traceId },
        },
        traceId
    );

    if (!planResponse.success || !planResponse.output) {
        throw new AppError(
            502,
            `Planning failed: ${planResponse.error?.summary ?? "unknown"}`,
            "plan_failed"
        );
    }

    const { scenes, styleManifest }: { scenes: SceneSpec[]; styleManifest: StyleManifest } =
        planResponse.output;

    progress("plan_complete", "agent_plan", { sceneCount: scenes.length });

    // ── Step 5: Per-scene processing ─────────────────────────────────────────
    const limit = makeLimiter(SCENE_CONCURRENCY);

    const sceneStates: SceneState[] = scenes.map((spec) => ({
        sceneIndex: spec.index,
        sceneSpec: spec,
        sceneClass: "",
        code: "",
        attempts: 0,
        status: "pending",
    }));

    const renderQuality = generationOptions?.quality ?? "medium";

    async function processScene(state: SceneState): Promise<void> {
        const { sceneSpec } = state;
        progress("scene_started", "scene", { index: state.sceneIndex });

        // a. Per-scene RAG enhance
        let scenePrompt = sceneSpec.prompt;
        let sceneRagContext: Parameters<typeof agentClient.code>[0]["codeExamples"] = undefined;

        try {
            const sceneRag = await ragClient.enhance({ prompt: scenePrompt }, traceId);
            scenePrompt = sceneRag.groundedPrompt;
            sceneRagContext = sceneRag.structuredContext.apiExamples.map((e) => ({
                description: e.docstring ?? e.symbol,
                code: e.snippet,
            }));
        } catch {
            // Non-fatal
        }

        // b. Agent code
        const codeResponse = await agentClient.code(
            {
                scenePlan: { ...sceneSpec, prompt: scenePrompt },
                styleManifest,
                codeExamples: sceneRagContext,
                modelConfig: {
                    coder: modelConfig.coder,
                    validator: modelConfig.validator,
                },
                meta: { traceId },
            },
            traceId
        );

        if (!codeResponse.success || !codeResponse.output?.code) {
            state.status = "failed";
            state.error = codeResponse.error?.summary ?? "code generation failed";
            progress("scene_failed", "scene", { index: state.sceneIndex, error: state.error });
            return;
        }

        state.code = codeResponse.output.code;
        state.sceneClass = codeResponse.output.sceneClass;
        progress("scene_code_complete", "scene", { index: state.sceneIndex, sceneClass: state.sceneClass });

        // c+d. Render with debug-retry loop (max 2 attempts)
        let lastRenderError: string | undefined;

        while (state.attempts < MAX_RENDER_ATTEMPTS) {
            state.attempts++;

            const renderResponse = await renderClient.render({
                code: state.code,
                sceneClass: state.sceneClass,
                render: { quality: renderQuality },
                storage: {
                    // Render service returns a local HTTP URL per scene.
                    // Final upload to Cloudinary happens in the API via
                    // uploadConcatToCloudinary() after ffmpeg concat.
                    backend: "local",
                    folder: `stitcher/scenes/${projectId ?? userId}`,
                    public: false,
                    generateThumbnail: true,
                    thumbnailAt: 1,
                },
                // 300s sandbox cap per scene; render service default is 120s
                // which is too aggressive for first-render LaTeX cache warm-up.
                limits: { timeoutSec: 300 },
                meta: { traceId },
            });

            if (renderResponse.success) {
                state.renderUrl = renderResponse.render.url;
                state.durationSec = renderResponse.render.durationSec;
                state.status = "success";
                progress("scene_render_complete", "scene", {
                    index: state.sceneIndex,
                    url: state.renderUrl,
                    attempt: state.attempts,
                });
                break;
            }

            // Render returned success:false — Manim execution failed
            lastRenderError = renderResponse.error.summary;
            logger.warn({
                message: "[worker] scene render failed",
                index: state.sceneIndex,
                attempt: state.attempts,
                traceId,
                summary: lastRenderError,
            });

            if (state.attempts >= MAX_RENDER_ATTEMPTS) {
                // Exhausted budget
                break;
            }

            // d. Debug: ask agent to fix the code
            try {
                const debugResponse = await agentClient.debug(
                    {
                        brokenCode: state.code,
                        sceneClass: state.sceneClass,
                        error: {
                            stderr: renderResponse.error.stderr,
                            summary: renderResponse.error.summary,
                            line: renderResponse.error.line,
                            category: renderResponse.error.category,
                        },
                        originalPrompt: sceneSpec.prompt,
                        modelConfig: {
                            debugger: modelConfig.debugger,
                            validator: modelConfig.validator,
                        },
                        meta: { traceId },
                    },
                    traceId
                );

                if (debugResponse.success && debugResponse.output?.code) {
                    state.code = debugResponse.output.code;
                    if (debugResponse.output.sceneClass) {
                        state.sceneClass = debugResponse.output.sceneClass;
                    }
                }
                // If debug itself failed, the while loop will hit the attempt cap and exit
            } catch (debugErr) {
                logger.warn({
                    message: "[worker] debug call failed",
                    index: state.sceneIndex,
                    traceId,
                    error: String(debugErr),
                });
            }
        }

        if (state.status !== "success") {
            state.status = "failed";
            state.error = lastRenderError ?? "render failed after max attempts";
            progress("scene_failed", "scene", { index: state.sceneIndex, error: state.error });
            return;
        }

        // e. Persist Asset in Mongo
        try {
            const asset = new Asset({
                name: `${state.sceneClass}-${chatId}-${state.sceneIndex}`,
                type: AssetType.VIDEO,
                code: state.code,
                scene_name: state.sceneClass,
                scene_description: sceneSpec.description ?? sceneSpec.prompt.slice(0, 200),
                origin: AssetOrigin.GENERATED_VIDEO,
                url: state.renderUrl!,
                thumbnail: "",
                durationSec: state.durationSec,
                bytes: 0,
                metadata: { traceId, sceneIndex: state.sceneIndex },
                projectId: new Types.ObjectId(projectId ?? userId),
                isOnTimeline: false,
            });
            await asset.save();
            state.assetId = (asset._id as Types.ObjectId).toString();
        } catch (assetErr) {
            // Non-fatal — we still have the URL
            logger.warn({
                message: "[worker] Asset persist failed",
                index: state.sceneIndex,
                traceId,
                error: String(assetErr),
            });
        }
    }

    // Run all scenes with the concurrency limiter
    await Promise.all(
        sceneStates.map((state) => limit(() => processScene(state)))
    );

    // Check if any scenes failed
    const failedScenes = sceneStates.filter((s) => s.status === "failed");
    if (failedScenes.length > 0) {
        const failedIndices = failedScenes.map((s) => s.sceneIndex).join(", ");
        throw new AppError(
            502,
            `Scene(s) ${failedIndices} failed after ${MAX_RENDER_ATTEMPTS} attempts`,
            "scenes_failed"
        );
    }

    // ── Step 6: ffmpeg concat ────────────────────────────────────────────────
    progress("concat_started", "concat");

    const sceneUrls = sceneStates
        .sort((a, b) => a.sceneIndex - b.sceneIndex)
        .map((s) => s.renderUrl!);

    const outputName = `final-${chatId}.mp4`;
    const { filePath, cleanup } = await concatVideos(sceneUrls, outputName);

    let finalUrl: string;
    let thumbnailUrl: string | undefined;

    try {
        const uploaded = await uploadConcatToCloudinary(
            filePath,
            `stitcher/final/${projectId ?? userId}`
        );
        finalUrl = uploaded.url;
        thumbnailUrl = uploaded.thumbnailUrl;
    } finally {
        // Always delete temp files regardless of upload success/failure
        await cleanup();
    }

    const totalDurationSec = sceneStates.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

    // ── Step 7: Update GenerateChat ──────────────────────────────────────────
    await GenerateChat.findByIdAndUpdate(chatId, {
        $set: {
            "messages.$[last].completed": true,
            "messages.$[last].generatorOutput": true,
            "messages.$[last].error": "none",
            "messages.$[last].content.llmResponse": finalUrl,
        },
    }, {
        arrayFilters: [{ "last.role": "assistant", "last.completed": false }],
    });

    // ── Step 8: Decrement credits (atomic; won't go below zero) ─────────────
    if (!user.isTestAccount) {
        await User.updateOne(
            { _id: userId, "credits.generation": { $gt: 0 } },
            { $inc: { "credits.generation": -1 } }
        );
    }

    // ── Step 9: Best-effort RAG corpus storage ───────────────────────────────
    let ragCorpusStored = false;
    try {
        const successfulScenes = sceneStates.filter((s) => s.status === "success");
        if (successfulScenes.length > 0) {
            const docs = successfulScenes.map((s) => ({
                child: { prompt: s.sceneSpec.prompt, code: s.code, sceneClass: s.sceneClass },
                metadata: { traceId, chatId, projectId },
            }));
            const corpusResult = await ragClient.corpusAdd({ documents: docs }, traceId);
            ragCorpusStored = corpusResult.allSucceeded;
        }
    } catch (ragErr) {
        logger.warn({ message: "[worker] RAG corpusAdd failed (non-fatal)", traceId, error: String(ragErr) });
    }

    // ── Build result ─────────────────────────────────────────────────────────
    const sceneAssets = sceneStates.map((s) => ({
        index: s.sceneIndex,
        url: s.renderUrl!,
        assetId: s.assetId ?? "",
    }));

    return {
        finalUrl,
        thumbnailUrl,
        durationSec: totalDurationSec,
        sceneAssets,
        ragCorpusStored,
    };
}

// ─── Worker instance ──────────────────────────────────────────────────────────

export const generationWorker = new Worker<VideoGenerationJobData, VideoGenerationJobResult>(
    "video-generation",
    processGenerationJob,
    {
        connection: redisConnection,
        concurrency: 4,
        lockDuration: 600_000, // 10 minutes — render is synchronous and slow
    }
);

// ─── Worker event listeners ───────────────────────────────────────────────────

generationWorker.on("failed", (job, err) => {
    logger.error({
        message: "job failed",
        jobId: job?.id,
        chatId: job?.data.chatId,
        error: String(err),
        traceId: job?.data.traceId,
    });
    if (job) {
        // On ServiceError 503, BullMQ will retry automatically per defaultJobOptions.
        // We still publish so the frontend can show "retrying…" state.
        const isRetryable = err instanceof ServiceError && err.status === 503;
        publishProgress(job.data.chatId, {
            type: "job_failed",
            phase: "worker",
            data: {
                error: String(err),
                retryable: isRetryable,
                jobId: job.id,
            },
        });

        // Mark the chat's in-progress assistant message as errored
        GenerateChat.findByIdAndUpdate(job.data.chatId, {
            $set: {
                "messages.$[last].completed": true,
                "messages.$[last].error": err instanceof AppError ? (err.code ?? "job_failed") : "job_failed",
            },
        }, {
            arrayFilters: [{ "last.role": "assistant", "last.completed": false }],
        }).catch((mongoErr: unknown) => {
            logger.error({ message: "Failed to mark chat as errored", chatId: job.data.chatId, error: String(mongoErr) });
        });
    }
});

generationWorker.on("completed", (job, result) => {
    logger.info({
        message: "job completed",
        jobId: job.id,
        chatId: job.data.chatId,
        finalUrl: result.finalUrl,
        traceId: job.data.traceId,
    });
    publishProgress(job.data.chatId, {
        type: "job_complete",
        phase: "worker",
        data: result,
    });
});

generationWorker.on("error", (err) => {
    logger.error({ message: "generationWorker error event", error: String(err) });
});
