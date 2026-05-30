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
import {
    trace,
    context,
    propagation,
    SpanStatusCode,
    type Span,
    type Context,
} from "@opentelemetry/api";
import { redisConnection } from "./connection";
import { pipelineStepDuration } from "../util/metrics.util";
import { ragClient } from "../services/ragClient";
import { agentClient } from "../services/agentClient";
import { renderClient } from "../services/renderClient";
import { ServiceError } from "../services/ServiceError";
import { resolveModelConfig, hasOwnKeys } from "./modelConfig.util";
import { publishProgress } from "./eventPublisher.util";
import { setJobStatus, setJobSceneTotal, incrementJobScene } from "./jobTracker.util";
import { concatVideos, uploadConcatToCloudinary } from "../util/ffmpegConcat.util";
import { buildAudioBundle } from "../services/ttsClient";
import type { VoiceoverSpec } from "../services/renderClient";
import { recall, reflect } from "../services/memoryService";
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

// ─── OTel tracing helper ──────────────────────────────────────────────────────
// All pipeline spans are created from this tracer. See OBSERVABILITY §3b.

const tracer = trace.getTracer("stitcher-api/generation");

/**
 * Run `fn` inside a child span of `parentCtx`, named `pipeline.<step>` per the
 * contract, with the supplied attributes. Records the exception + ERROR status
 * on throw, and records the step duration into the histogram tagged
 * { step, success }. Re-throws so control flow is unchanged.
 */
async function withStep<T>(
    parentCtx: Context,
    step: string,
    attrs: Record<string, string | number | boolean>,
    fn: () => Promise<T>
): Promise<T> {
    const span = tracer.startSpan(`pipeline.${step}`, { attributes: attrs }, parentCtx);
    const spanCtx = trace.setSpan(parentCtx, span);
    const start = Date.now();
    let success = false;
    try {
        const result = await context.with(spanCtx, fn);
        success = true;
        return result;
    } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
    } finally {
        span.end();
        pipelineStepDuration.record(Date.now() - start, { step, success });
    }
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
    thumbnailUrl?: string;
    assetId?: string;
    durationSec?: number;
    error?: string;
}

// ─── Worker process function ──────────────────────────────────────────────────

const SCENE_CONCURRENCY = parseInt(process.env["WORKER_SCENE_CONCURRENCY"] ?? "3", 10);
const MAX_RENDER_ATTEMPTS = 2;

/**
 * BullMQ processor entrypoint.
 *
 * OBSERVABILITY §3a/§3b: extract the W3C trace context injected at enqueue time,
 * open the root `generation.job` span as a child of the originating request
 * trace, then run the pipeline inside that active context so every child span
 * and every auto-instrumented HTTP call (agent/rag/render) joins the trace.
 */
async function processGenerationJob(
    job: Job<VideoGenerationJobData, VideoGenerationJobResult>
): Promise<VideoGenerationJobResult> {
    const { chatId, userId, projectId, traceId } = job.data;

    const parentCtx = propagation.extract(context.active(), job.data.otelCarrier ?? {});
    const rootSpan = tracer.startSpan(
        "generation.job",
        {
            attributes: {
                "stitcher.chat_id": chatId,
                "stitcher.user_id": userId,
                "stitcher.project_id": projectId ?? "",
                "stitcher.trace_id": traceId,
            },
        },
        parentCtx
    );
    const jobCtx = trace.setSpan(parentCtx, rootSpan);

    try {
        const result = await context.with(jobCtx, () =>
            runGenerationPipeline(job, jobCtx, rootSpan)
        );
        rootSpan.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (err) {
        rootSpan.recordException(err as Error);
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
    } finally {
        rootSpan.end();
    }
}

async function runGenerationPipeline(
    job: Job<VideoGenerationJobData, VideoGenerationJobResult>,
    jobCtx: Context,
    rootSpan: Span
): Promise<VideoGenerationJobResult> {
    const { chatId, userId, projectId, prompt, traceId, modelConfigOverride, generationOptions } =
        job.data;

    // F2.4: BullMQ job id correlates the persisted GenerationJob history row.
    const jobId = job.id;

    // ── Step 0: Update job progress helper ──────────────────────────────────
    // Also advances the persisted GenerationJob status on the coarse phase
    // transitions (non-fatal; jobTracker swallows DB errors).
    const progress = (type: Parameters<typeof publishProgress>[1]["type"], phase: string, data?: unknown) => {
        publishProgress(chatId, { type, phase, data });
        logger.debug({ message: `[worker] ${type}`, chatId, traceId, phase });
    };

    // ── Step 1: Load user (credit gate applied after model config resolves) ──
    const user = await User.findById(userId).select("credits isTestAccount").lean();
    if (!user) {
        throw new AppError(404, `User ${userId} not found`, "user_not_found");
    }

    // ── Step 2: Resolve model config ─────────────────────────────────────────
    // Resolved first so the credit gate can grant a BYOT (bring-your-own-token)
    // exhaust path when the user supplied their own provider keys.
    const modelConfig: ResolvedModelConfig = await resolveModelConfig(userId, modelConfigOverride);

    // ── Step 2b: Credit gate ─────────────────────────────────────────────────
    // Allow the run when ANY of:
    //   - test account                        (never billed)
    //   - generation credits remaining        (credit-funded path; unchanged)
    //   - user supplied their own keys (BYOT)  (zero-credit exhaust path)
    // Otherwise block. Conservative: if hasOwnKeys can't be confirmed we fall
    // through to the credit requirement and block keyless, credit-less users.
    const usingOwnKeys = hasOwnKeys(modelConfig);
    const hasCredits = user.credits.generation > 0;
    if (!user.isTestAccount && !hasCredits && !usingOwnKeys) {
        throw new AppError(402, "Insufficient generation credits", "insufficient_credits");
    }
    // True only when the run proceeds purely on the user's own keys (no credits
    // to spend) — in that case we must NOT decrement credits below.
    const runOnOwnKeys = !user.isTestAccount && !hasCredits && usingOwnKeys;

    // ── Step 3: RAG enhance (top-level prompt) ───────────────────────────────
    progress("planning", "rag_enhance");
    void setJobStatus(jobId, "planning");
    let groundedPrompt = prompt;

    try {
        const ragResult = await withStep(jobCtx, "rag_enhance", { "scene.index": -1 }, () =>
            ragClient.enhance({ prompt }, traceId)
        );
        groundedPrompt = ragResult.groundedPrompt;
    } catch (err) {
        // RAG is best-effort at planning stage; proceed with raw prompt
        logger.warn({ message: "[worker] RAG enhance (top-level) failed; using raw prompt", traceId, error: String(err) });
    }

    // ── Step 3b: Inject long-term user memory (preferences) ──────────────────
    try {
        const userMemory = await recall(userId);
        if (userMemory) {
            groundedPrompt = `User preferences to honor (learned over time):\n${userMemory}\n\n${groundedPrompt}`;
        }
    } catch (err) {
        logger.warn({ message: "[worker] memory recall failed; proceeding without it", traceId, error: String(err) });
    }

    // ── Native voiceover flag ────────────────────────────────────────────────
    // Feature-flagged OFF by default. When off, NO voiceover field is sent to the
    // agent or render services and behavior is byte-for-byte unchanged from today.
    const voiceoverEnabled = generationOptions?.voiceover?.enabled === true;
    const voiceoverOpts = {
        provider: generationOptions?.voiceover?.provider,
        voice: generationOptions?.voiceover?.voice,
        lang: generationOptions?.voiceover?.language,
    };

    // ── Step 4: Agent plan ───────────────────────────────────────────────────
    progress("planning", "agent_plan");
    const planResponse = await withStep(
        jobCtx,
        "agent_plan",
        { model: modelConfig.planner.model, voiceover: voiceoverEnabled },
        () =>
            agentClient.plan(
                {
                    prompt: groundedPrompt,
                    modelConfig: { planner: modelConfig.planner },
                    constraints: {
                        minScenes: generationOptions?.minScenes,
                        maxScenes: generationOptions?.maxScenes,
                        targetTotalDurationSec: generationOptions?.targetTotalDurationSec,
                        renderQualityHint: generationOptions?.quality,
                    },
                    // Plan-authoritative narration: only request beats when voiceover
                    // is on. Omitted entirely when off (unchanged request shape).
                    ...(voiceoverEnabled ? { voiceover: true } : {}),
                    meta: { traceId },
                },
                traceId
            )
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
    void setJobSceneTotal(jobId, scenes.length);
    rootSpan.setAttribute("scene.count", scenes.length);

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

    // OBSERVABILITY §3b: each scene gets a `pipeline.scene` span (attr scene.index)
    // wrapping its agent_code / render / agent_debug child spans.
    async function processScene(state: SceneState): Promise<void> {
        const sceneSpan = tracer.startSpan(
            "pipeline.scene",
            { attributes: { "scene.index": state.sceneIndex } },
            jobCtx
        );
        const sceneCtx = trace.setSpan(jobCtx, sceneSpan);
        try {
            await context.with(sceneCtx, () => processSceneInner(state, sceneCtx));
            if (state.status !== "success") {
                sceneSpan.setStatus({ code: SpanStatusCode.ERROR, message: state.error ?? "scene failed" });
            }
        } finally {
            sceneSpan.end();
        }
    }

    async function processSceneInner(state: SceneState, sceneCtx: Context): Promise<void> {
        const { sceneSpec } = state;
        progress("scene_started", "scene", { index: state.sceneIndex });

        // a. Per-scene RAG enhance
        let scenePrompt = sceneSpec.prompt;
        let sceneRagContext: Parameters<typeof agentClient.code>[0]["codeExamples"] = undefined;

        try {
            const sceneRag = await withStep(sceneCtx, "rag_enhance", { "scene.index": state.sceneIndex }, () =>
                ragClient.enhance({ prompt: scenePrompt }, traceId)
            );
            scenePrompt = sceneRag.groundedPrompt;
            sceneRagContext = sceneRag.structuredContext.apiExamples.map((e) => ({
                description: e.docstring ?? e.symbol,
                code: e.snippet,
            }));
        } catch {
            // Non-fatal
        }

        // Guard: voiceover ON requires planned narration beats. Fail clearly
        // rather than sending a half-bundle (which would desync render lookups).
        if (voiceoverEnabled && (!sceneSpec.narration || sceneSpec.narration.length === 0)) {
            state.status = "failed";
            state.error = "voiceover enabled but planner returned no narration beats for this scene";
            progress("scene_failed", "scene", { index: state.sceneIndex, error: state.error });
            return;
        }

        // b. Agent code  ||  TTS audio bundle (REQUIRED parallelism when voiceover
        //    is ON: TTS of the PLANNED beats overlaps code generation, since the
        //    bundle is keyed off the plan, not the generated code). The agent's
        //    validator guarantees the generated voiceover texts equal the planned
        //    beats, so OfflineTTS finds each `<cacheKey>.mp3` at render time.
        const codePromise = withStep(
            sceneCtx,
            "agent_code",
            { "scene.index": state.sceneIndex, model: modelConfig.coder.model, voiceover: voiceoverEnabled },
            () =>
                agentClient.code(
                    {
                        scenePlan: { ...sceneSpec, prompt: scenePrompt },
                        styleManifest,
                        codeExamples: sceneRagContext,
                        modelConfig: {
                            coder: modelConfig.coder,
                            validator: modelConfig.validator,
                        },
                        ...(voiceoverEnabled ? { voiceover: true } : {}),
                        meta: { traceId },
                    },
                    traceId
                )
        );

        const ttsPromise: Promise<VoiceoverSpec | undefined> = voiceoverEnabled
            ? withStep(
                  sceneCtx,
                  "tts",
                  { "scene.index": state.sceneIndex, beats: sceneSpec.narration!.length },
                  async () => ({
                      audio: await buildAudioBundle(sceneSpec.narration!, voiceoverOpts),
                  })
              )
            : Promise.resolve(undefined);

        const [codeResponse, voiceoverBundle] = await Promise.all([codePromise, ttsPromise]);

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
            const currentAttempt = state.attempts;

            const renderResponse = await withStep(
                sceneCtx,
                "render",
                { "scene.index": state.sceneIndex, attempt: currentAttempt },
                () =>
                    renderClient.render({
                        code: state.code,
                        sceneClass: state.sceneClass,
                        render: { quality: renderQuality },
                        // Reuse the SAME bundle across debug-retries — the debugger
                        // preserves the narration beats, so no re-synthesis needed.
                        // Omitted entirely when voiceover is off (unchanged shape).
                        ...(voiceoverBundle ? { voiceover: voiceoverBundle } : {}),
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
                    })
            );

            if (renderResponse.success) {
                state.renderUrl = renderResponse.render.url;
                state.thumbnailUrl = renderResponse.render.thumbnailUrl;
                state.durationSec = renderResponse.render.durationSec;
                state.status = "success";
                progress("scene_render_complete", "scene", {
                    index: state.sceneIndex,
                    url: state.renderUrl,
                    attempt: state.attempts,
                });
                void incrementJobScene(jobId);
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
                const debugResponse = await withStep(
                    sceneCtx,
                    "agent_debug",
                    { "scene.index": state.sceneIndex, attempt: currentAttempt, model: modelConfig.debugger.model },
                    () =>
                        agentClient.debug(
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
                                // Keep the VoiceoverScene shape + preserve beats so
                                // the reused audio bundle still resolves at render.
                                ...(voiceoverEnabled ? { voiceover: true } : {}),
                                meta: { traceId },
                            },
                            traceId
                        )
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
                thumbnail: state.thumbnailUrl ?? state.renderUrl!,
                duration: state.durationSec,
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
    void setJobStatus(jobId, "concatenating");

    const sceneUrls = sceneStates
        .sort((a, b) => a.sceneIndex - b.sceneIndex)
        .map((s) => s.renderUrl!);

    const outputName = `final-${chatId}.mp4`;
    const { filePath, cleanup } = await withStep(
        jobCtx,
        "concat",
        { "scene.count": sceneUrls.length },
        () => concatVideos(sceneUrls, outputName)
    );

    let finalUrl: string;
    let thumbnailUrl: string | undefined;

    void setJobStatus(jobId, "uploading");

    try {
        const uploaded = await withStep(jobCtx, "upload", {}, () =>
            uploadConcatToCloudinary(filePath, `stitcher/final/${projectId ?? userId}`)
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
    // Skip the decrement entirely for BYOT runs (credits<=0 && own keys): the
    // user funded this generation with their own provider key, so it costs us
    // nothing and must not touch their (already-zero) credit balance. The
    // credit-funded path is unchanged.
    if (!user.isTestAccount && !runOnOwnKeys) {
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

    // ── Step 10: Memory reflection (fire-and-forget; never blocks the result) ─
    // Ask the cheap LLM whether this turn reveals any durable user preference.
    reflect(userId, {
        userMessage: prompt,
        assistantMessage: `Generated a ${scenes.length}-scene video.`,
    }).catch((err) => {
        logger.warn({ message: "[worker] memory reflect failed (non-fatal)", traceId, error: String(err) });
    });

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

        // F2.4: mark the persisted history row failed (non-fatal). Only on the
        // terminal failure (BullMQ retries exhausted) — retryable 503s keep the
        // row in its current in-progress state so the UI can show "retrying…".
        if (!isRetryable) {
            void setJobStatus(job.id, "failed", { error: String(err), completedAt: new Date() });
        }

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

    // F2.4: finalize the persisted history row (non-fatal).
    void setJobStatus(job.id, "complete", { finalUrl: result.finalUrl, completedAt: new Date() });
});

generationWorker.on("error", (err) => {
    logger.error({ message: "generationWorker error event", error: String(err) });
});
