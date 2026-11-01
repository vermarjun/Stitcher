/**
 * BullMQ worker for the video-generation pipeline.
 *
 * Pipeline steps per job (LINEAR, SINGLE-SCENE):
 *   1. Resolve provider config from env
 *   2. RAG enhance  → examples (similarScripts) + requiredApis
 *   3. Agent /code  → { code, sceneClass } (single LLM completion, no planner)
 *   4. Validate (code response success flag)
 *   5. Voiceover (ALWAYS ON, NON-FATAL): extract self.voiceover texts → TTS bundle
 *   6. Render → finalUrl
 *   7. Debug loop (max 3): on validate/render failure → agent /debug → re-render
 *   8. Persist Asset + GenerateChat + tokens + stages
 *   9. Emit job_complete { finalUrl }
 *
 * Removed: planner (agent /plan), per-scene fan-out loop + concurrency cap,
 *          ffmpeg concat, voiceover on/off branching.
 *
 * Preserved: withStep() + appendJobStage + setJobTokens (observability),
 *            OTEL trace propagation, socket/UI events.
 */

import { Worker, Job, UnrecoverableError } from "bullmq";
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
import { resolveModelConfig, resolveRagProviderConfig, resolveTts } from "../providers.config";
import type { ResolvedTtsConfig } from "../services/ttsClient";
import { publishProgress } from "./eventPublisher.util";
import { setJobStatus, setJobSceneTotal, incrementJobScene, appendJobStage, setJobTokens, setJobProgress } from "./jobTracker.util";
import { getPhaseMeta, type GenerationPhase } from "./pipelinePhases";
import { buildAudioBundle } from "../services/ttsClient";
import { ingestRenderedFile } from "../storage/ingest";
import type { VoiceoverSpec } from "../services/renderClient";
import { recall, reflect } from "../services/memoryService";
import GenerateChat from "../model/generateChat.model";
import Asset, { AssetType, AssetOrigin } from "../model/asset.model";
import GenerationLlmIO, { IO_FIELD_CAP } from "../model/generationLlmIO.model";
import type { RagTrace } from "../services/ragClient";
import CoderLesson from "../model/coderLesson.model";
import GenerationJob from "../model/generationJob.model";
import type { LlmCallLogEntry, DebugHistoryEntry, LlmRoleConfig } from "../services/agentClient";
import logger from "../util/logger.util";
import { buildFallbackSceneCode, FALLBACK_SCENE_CLASS } from "../util/fallbackScene.util";

// ─── Cancellation support ─────────────────────────────────────────────────────

export const CANCEL_KEY = (chatId: string) => `gen:cancel:${chatId}`;
const CANCEL_TTL_SEC = 600; // 10 min — auto-expires so Redis doesn't leak

/**
 * Set the cancellation flag for a chat. The worker checks this between steps
 * and throws UnrecoverableError('cancelled') so BullMQ doesn't retry.
 */
export async function markCancelled(chatId: string): Promise<void> {
    await redisConnection.set(CANCEL_KEY(chatId), "1", "EX", CANCEL_TTL_SEC);
}

/**
 * Throws UnrecoverableError('cancelled') if the flag is set.
 * Call this between expensive pipeline steps.
 */
async function assertNotCancelled(chatId: string): Promise<void> {
    const flag = await redisConnection.get(CANCEL_KEY(chatId));
    if (flag) throw new UnrecoverableError("cancelled");
}
import { AppError } from "../util/AppError";
import type {
    VideoGenerationJobData,
    VideoGenerationJobResult,
} from "./types";
import type { AgentTokensUsed } from "../services/agentClient";
import type { StageId, StageService, IJobStage } from "../model/generationJob.model";

// ─── Stage → service mapping ──────────────────────────────────────────────────

const STAGE_SERVICE: Record<StageId, StageService> = {
    rag_enhance:  "stitcher-rag",
    agent_plan:   "stitcher-agent",
    agent_code:   "stitcher-agent",
    agent_debug:  "stitcher-agent",
    render:       "stitcher-render",
    tts:          "stitcher-api",
    concat:       "stitcher-api",
    upload:       "stitcher-api",
};

// ─── LLM I/O persistence helper ──────────────────────────────────────────────

/** Cap a string to IO_FIELD_CAP bytes (UTF-16 code units as a proxy). Non-fatal. */
function capString(s: string | undefined | null): string {
    if (!s) return "";
    return s.length > IO_FIELD_CAP ? s.slice(0, IO_FIELD_CAP) : s;
}

/**
 * Persist one GenerationLlmIO document per LlmCallLogEntry in a response's
 * llmCallLog (or llmIO) array.
 *
 * Best-effort: wraps everything in try/catch. A Mongo failure here must never
 * crash the pipeline. Called for BOTH success and failure paths.
 */
async function persistLlmIO(opts: {
    jobId: string | undefined;
    chatId: string | undefined;
    stage: "agent_code" | "agent_debug" | "query_transform" | "rag_enhance" | "reflect";
    attempt: number;
    sceneIndex?: number;
    entries: LlmCallLogEntry[] | undefined;
    error?: string;
}): Promise<void> {
    if (!opts.jobId) return;
    const entries = opts.entries;
    if (!entries || entries.length === 0) {
        // Even if no llmCallLog was returned (agent didn't emit it yet or call failed
        // before any LLM call), persist a single placeholder row so the job detail
        // shows that the stage was attempted.
        if (opts.error) {
            try {
                await GenerationLlmIO.create({
                    jobId: opts.jobId,
                    chatId: opts.chatId ? new Types.ObjectId(opts.chatId) : undefined,
                    stage: opts.stage,
                    sceneIndex: opts.sceneIndex ?? 0,
                    attempt: opts.attempt,
                    role: opts.stage,
                    provider: "unknown",
                    llmModel: "unknown",
                    systemPrompt: "",
                    userPrompt: "",
                    rawOutput: "",
                    error: capString(opts.error),
                });
            } catch { /* non-fatal */ }
        }
        return;
    }
    try {
        const docs = entries.map((e) => ({
            jobId: opts.jobId,
            chatId: opts.chatId ? new Types.ObjectId(opts.chatId) : undefined,
            stage: opts.stage,
            sceneIndex: opts.sceneIndex ?? 0,
            attempt: opts.attempt,
            role: e.role,
            provider: e.provider,
            llmModel: e.model,
            systemPrompt: capString(e.systemPrompt),
            userPrompt: capString(e.userPrompt),
            fullInput: e.fullInput,
            rawOutput: capString(e.rawOutput),
            tokensUsed: e.inputTokens !== undefined
                ? { input: e.inputTokens, output: e.outputTokens }
                : undefined,
            error: opts.error ? capString(opts.error) : undefined,
        }));
        await GenerationLlmIO.insertMany(docs, { ordered: false });
    } catch (err) {
        logger.warn({ message: "[worker] persistLlmIO failed (non-fatal)", jobId: opts.jobId, stage: opts.stage, error: String(err) });
    }
}

/**
 * Persist RAG pipeline trace as two GenerationLlmIO rows (best-effort, non-fatal):
 *   1. stage="query_transform" — the LLM call made by the RAG service (if it ran)
 *   2. stage="rag_enhance", role="retrieval" — non-LLM embed/retrieve/select data
 *
 * Called after ragClient.enhance() returns on BOTH success and failure paths.
 * A missing or partial trace never throws; all errors are swallowed.
 */
async function persistRagTrace(opts: {
    jobId: string | undefined;
    chatId: string | undefined;
    trace: RagTrace | undefined;
    error?: string;
}): Promise<void> {
    if (!opts.jobId) return;
    const t = opts.trace;

    // Row 1: query_transform LLM call. Persist whenever the trace exists — including
    // the degraded (ran:false) case (timeout/no-JSON), so the log shows why a
    // job got no plugins instead of the transform silently vanishing from the I/O log.
    if (t?.queryTransform) {
        try {
            const qt = t.queryTransform;
            await GenerationLlmIO.create({
                jobId: opts.jobId,
                chatId: opts.chatId ? new Types.ObjectId(opts.chatId) : undefined,
                stage: "query_transform",
                sceneIndex: 0,
                attempt: 0,
                role: "query_transform",
                provider: capString(qt.provider ?? "unknown"),
                llmModel: capString(qt.model ?? "unknown"),
                systemPrompt: capString(qt.systemPrompt),
                userPrompt: capString(qt.userPrompt),
                rawOutput: capString(qt.rawOutput),
                tokensUsed: qt.tokensUsed,
                error: opts.error
                    ? capString(opts.error)
                    : (qt.ran ? undefined : capString("query_transform did not run (timeout/degraded → raw-query fallback, no requiredPlugins)")),
            });
        } catch { /* non-fatal */ }
    }

    // Row 2: retrieval row (embed + retrieve + select — non-LLM pipeline data)
    try {
        const retrievalTrace = t
            ? {
                searchQuery: t.retrieve?.searchQuery,
                dense: t.retrieve?.dense,
                sparse: t.retrieve?.sparse,
                merged: t.retrieve?.merged,
                select: t.select,
                embed: t.embed,
              }
            : undefined;
        await GenerationLlmIO.create({
            jobId: opts.jobId,
            chatId: opts.chatId ? new Types.ObjectId(opts.chatId) : undefined,
            stage: "rag_enhance",
            sceneIndex: 0,
            attempt: 0,
            role: "retrieval",
            provider: capString(t?.embed?.provider ?? "rag"),
            llmModel: capString(t?.embed?.model ?? "unknown"),
            // These three are required:true on the schema and Mongoose rejects "" for a
            // required String — so empty strings here silently threw and the retrieval
            // row never persisted (0/30 in the stress test). Use non-LLM placeholders.
            systemPrompt: "(rag retrieval — non-LLM stage)",
            userPrompt: "(embed → retrieve → select; see retrievalTrace)",
            rawOutput: "(see retrievalTrace field)",
            retrievalTrace,
            error: opts.error ? capString(opts.error) : undefined,
        });
    } catch { /* non-fatal */ }
}

// ─── Job-scoped token accumulator ─────────────────────────────────────────────

interface TokenAccumulator {
    input: number;
    output: number;
    /** Flat call log for per-model cost computation. */
    calls: Array<{ model: string; inputTokens: number; outputTokens: number }>;
}

function makeTokenAccumulator(): {
    acc: TokenAccumulator;
    add: (t?: AgentTokensUsed, model?: string) => void;
} {
    const acc: TokenAccumulator = { input: 0, output: 0, calls: [] };
    return {
        acc,
        add(t?: AgentTokensUsed, model?: string) {
            if (!t) return;
            const inTok = t.input ?? 0;
            const outTok = t.output ?? 0;
            acc.input += inTok;
            acc.output += outTok;
            if (model) {
                acc.calls.push({ model, inputTokens: inTok, outputTokens: outTok });
            }
        },
    };
}

// ─── OTel tracing helper ──────────────────────────────────────────────────────

const tracer = trace.getTracer("stitcher-api/generation");

/**
 * Run `fn` inside a child span of `parentCtx`, named `pipeline.<step>`.
 * Records exception + ERROR status on throw, records step duration into the
 * histogram. Re-throws so control flow is unchanged.
 *
 * Auto-pushes a stage row to the persisted job record (best-effort) when:
 *   - On success: caller provided onSuccess
 *   - On failure (throw): always pushed (onFail is optional; absence means no extras)
 */
async function withStep<T>(
    parentCtx: Context,
    step: string,
    attrs: Record<string, string | number | boolean>,
    fn: () => Promise<T>,
    extras?: {
        jobId?: string | undefined;
        stageId: StageId;
        sceneIndex?: number;
        onSuccess?: (result: T) => Partial<Pick<IJobStage, "tokens" | "model" | "outputSummary">>;
        onFail?: (err: unknown) => Partial<Pick<IJobStage, "model" | "outputSummary" | "failedCode">>;
    }
): Promise<T> {
    const span = tracer.startSpan(`pipeline.${step}`, { attributes: attrs }, parentCtx);
    const spanCtx = trace.setSpan(parentCtx, span);
    const startedAt = new Date();
    const startMs = startedAt.getTime();
    let success = false;
    let stageResult: T | undefined;
    let stageErr: unknown;
    try {
        const result = await context.with(spanCtx, fn);
        stageResult = result;
        success = true;
        return result;
    } catch (err) {
        stageErr = err;
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
    } finally {
        span.end();
        const endedAt = new Date();
        const durationMs = endedAt.getTime() - startMs;
        pipelineStepDuration.record(durationMs, { step, success });

        const shouldAutoPush = extras?.jobId && extras.stageId &&
            (success ? !!extras.onSuccess : true);
        if (shouldAutoPush) {
            try {
                const stageId = extras!.stageId;
                const base: IJobStage = {
                    stage: stageId,
                    service: STAGE_SERVICE[stageId],
                    sceneIndex: extras!.sceneIndex,
                    status: success ? "ok" : "failed",
                    error: success ? undefined : String(stageErr),
                    startedAt,
                    endedAt,
                    durationMs,
                };
                const additional = success
                    ? (extras!.onSuccess!(stageResult as T))
                    : (extras!.onFail?.(stageErr) ?? {});
                const row: IJobStage = { ...base, ...additional };
                void appendJobStage(extras!.jobId!, row);
            } catch {
                // Instrumentation must never crash the pipeline
            }
        }
    }
}

// ─── Voiceover text extraction from generated Manim code ─────────────────────

/**
 * Extract all `self.voiceover(text="…")` string literals from Manim Python code.
 * Handles both double-quoted and single-quoted text argument, including escaped
 * quotes within (non-greedy match). Returns an ordered array of unique beat
 * strings in first-occurrence order (preserving the sha256 cache-key contract
 * — the render side hashes the exact text literal from the code).
 *
 * Non-fatal: if parsing yields nothing the TTS step is skipped gracefully.
 */
function extractVoiceoverTexts(code: string): string[] {
    const seen = new Set<string>();
    const results: string[] = [];

    // Match: self.voiceover(text="...") or self.voiceover(text='...')
    // Also matches: self.voiceover("...") and self.voiceover('...')
    // Uses a simple regex; does not handle triple-quoted strings (not used in practice).
    const patterns = [
        /self\.voiceover\s*\(\s*text\s*=\s*"((?:[^"\\]|\\.)*)"/g,
        /self\.voiceover\s*\(\s*text\s*=\s*'((?:[^'\\]|\\.)*)'/g,
        /self\.voiceover\s*\(\s*"((?:[^"\\]|\\.)*)"/g,
        /self\.voiceover\s*\(\s*'((?:[^'\\]|\\.)*)'/g,
    ];

    for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(code)) !== null) {
            const text = match[1]!
                // Unescape common Python escape sequences
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, "\\")
                .trim();
            if (text.length > 0 && !seen.has(text)) {
                seen.add(text);
                results.push(text);
            }
        }
    }

    return results;
}

// ─── Worker process function ──────────────────────────────────────────────────

const MAX_DEBUG_ATTEMPTS = 3;

/**
 * BullMQ processor entrypoint.
 *
 * Extracts W3C trace context injected at enqueue time, opens the root
 * `generation.job` span as a child of the originating request trace, then
 * runs the pipeline inside that active context so every child span and every
 * auto-instrumented HTTP call joins the trace.
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
        // Cancelled by user — update the job record and notify the UI,
        // then re-throw so BullMQ marks it failed without retrying.
        if (err instanceof UnrecoverableError && err.message === "cancelled") {
            const { chatId, userId: _uid } = job.data;
            logger.info({ message: "[worker] generation cancelled by user", chatId, jobBullId: job.id });
            void setJobStatus(job.id, "failed");
            publishProgress(chatId, {
                type: "job_complete",
                phase: "cancelled",
                data: { status: "cancelled", finalUrl: null },
            });
            // Delete the flag so a future generation for the same chat starts clean.
            void redisConnection.del(CANCEL_KEY(chatId));
        }
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
    const { chatId, userId, projectId, prompt, traceId, generationOptions } =
        job.data;

    const jobId = job.id;

    // Wall-clock start of the generation pipeline — used to persist how long the
    // video took to generate (so "time taken" survives a page reload).
    const pipelineStartMs = Date.now();

    // ── Token accumulator ────────────────────────────────────────────────────
    const tokens = makeTokenAccumulator();

    // ── Progress helper ──────────────────────────────────────────────────────
    const progress = (type: Parameters<typeof publishProgress>[1]["type"], phase: string, data?: unknown) => {
        publishProgress(chatId, { type, phase, data });
        logger.debug({ message: `[worker] ${type}`, chatId, traceId, phase });
    };

    // ── Live phase helper ────────────────────────────────────────────────────
    // Advances the user-facing live progress for one real pipeline transition.
    // Does BOTH, from the single source of truth (PIPELINE_PHASES):
    //   1. persists progress to the job (reload-safe, monotonic percent)
    //   2. emits a `progress` socket event { phase, label, percent, ceil } so the
    //      bar + step label update live without polling.
    const phase = (key: GenerationPhase) => {
        void setJobProgress(jobId, key);
        const meta = getPhaseMeta(key);
        publishProgress(chatId, {
            type: "progress",
            phase: key,
            data: { phase: key, label: meta.label, percent: meta.percent, ceil: meta.ceil },
        });
        logger.debug({ message: `[worker] phase ${key}`, chatId, traceId, percent: meta.percent });
    };

    // ── Step 1: Resolve provider config from env ─────────────────────────────
    // Throws a clear error when a provider has no default model (openrouter
    // needs LLM_MODEL), so the job fails with a message the operator can act on.
    let modelConfig: ReturnType<typeof resolveModelConfig>;
    try {
        modelConfig = resolveModelConfig();
    } catch (cfgErr) {
        throw new AppError(500, (cfgErr as Error).message, "llm_not_configured");
    }
    const ragProviderConfig = resolveRagProviderConfig();
    const resolvedTtsConfig: ResolvedTtsConfig = resolveTts();

    // ── Cancellation gate ────────────────────────────────────────────────────
    await assertNotCancelled(chatId);

    // ── Step 3: RAG enhance ──────────────────────────────────────────────────
    // Returns examples (similarScripts) and requiredApis for the coder.
    progress("planning", "rag_enhance");
    void setJobStatus(jobId, "planning");
    phase("rag");

    let ragExamples: Array<{ description: string; code: string }> = [];
    let ragRequiredApis: string[] = [];
    let ragRequiredPlugins: string[] = [];

    try {
        const ragResult = await withStep(
            jobCtx,
            "rag_enhance",
            { "scene.index": 0 },
            () => ragClient.enhance({ prompt }, traceId, ragProviderConfig),
            {
                jobId,
                stageId: "rag_enhance",
                onSuccess: (r) => {
                    const scriptCount = Array.isArray(r.structuredContext.similarScripts)
                        ? r.structuredContext.similarScripts.length
                        : 0;
                    return { outputSummary: `${scriptCount} similarScripts` };
                },
                onFail: () => ({ outputSummary: "RAG down → raw prompt" }),
            }
        );

        // Persist RAG pipeline trace on success (best-effort, non-fatal)
        void persistRagTrace({ jobId, chatId, trace: ragResult.trace });

        // Extract similarScripts → examples for the coder (CONTRACT 2 input shape).
        // Cap at MAX_CODER_EXAMPLES: the RAG examples are ~70-85% of the codegen prompt
        // (5 full scenes ≈ 5-6k tokens). The relevance-first selector ranks them, so the
        // top 3 are the on-domain ones; 3 cuts ~40% of the user-message tokens with
        // negligible quality loss.
        const MAX_CODER_EXAMPLES = 3;
        if (Array.isArray(ragResult.structuredContext.similarScripts)) {
            ragExamples = ragResult.structuredContext.similarScripts
                .filter((s): s is Record<string, unknown> => s != null && typeof s === "object")
                .map((s) => ({
                    description: String((s as Record<string, unknown>)["description"] ?? ""),
                    code: String((s as Record<string, unknown>)["code"] ?? ""),
                }))
                .filter((e) => e.code.length > 0)
                .slice(0, MAX_CODER_EXAMPLES);
        }

        // requiredApis from RAG query-transform (CONTRACT 1 output)
        const ra = (ragResult.structuredContext as unknown as Record<string, unknown>)["requiredApis"];
        if (Array.isArray(ra)) {
            ragRequiredApis = ra.filter((x): x is string => typeof x === "string");
        }

        // requiredPlugins from RAG query-transform — drives plugin-skill injection in the coder
        const rp = (ragResult.structuredContext as unknown as Record<string, unknown>)["requiredPlugins"];
        if (Array.isArray(rp)) {
            ragRequiredPlugins = rp.filter((x): x is string => typeof x === "string");
        }
    } catch (err) {
        // RAG is best-effort; proceed with empty examples + raw prompt
        logger.warn({ message: "[worker] RAG enhance failed; using raw prompt", traceId, error: String(err) });
        // Persist an error row so the job detail shows RAG was attempted (best-effort)
        void persistRagTrace({ jobId, chatId, trace: undefined, error: String(err) });
    }

    // ── Step 3b: Long-term user memory ───────────────────────────────────────
    let effectivePrompt = prompt;
    try {
        const userMemory = await recall(userId);
        if (userMemory) {
            effectivePrompt = `User preferences to honor (learned over time):\n${userMemory}\n\n${prompt}`;
        }
    } catch (err) {
        logger.warn({ message: "[worker] memory recall failed; proceeding without it", traceId, error: String(err) });
    }

    // ── Step 3c: Fetch coder memory (most-recent 25 lessons) ────────────────
    // Best-effort: if the fetch fails, proceed without lessons.
    let coderMemory: string[] = [];
    try {
        const lessons = await CoderLesson.find()
            .sort({ createdAt: -1 })
            .limit(25)
            .select("lesson")
            .lean();
        coderMemory = lessons.map((l) => l.lesson).filter(Boolean);
    } catch (err) {
        logger.warn({ message: "[worker] coderMemory fetch failed (non-fatal)", traceId, error: String(err) });
    }

    // ── Cancellation gate ────────────────────────────────────────────────────
    await assertNotCancelled(chatId);

    // ── Step 4: Agent /code (single completion, no planner) ─────────────────
    // sceneProgress 1 total (single scene)
    void setJobSceneTotal(jobId, 1);
    void setJobStatus(jobId, "rendering");
    progress("planning", "agent_code");
    phase("code");
    rootSpan.setAttribute("scene.count", 1);

    // Default to 480p15 ("low"): renders ~4x faster than 720p30, which keeps the
    // box well inside the render budget and frees time for richer codegen. A request
    // can still pass an explicit quality to override this default.
    const renderQuality = generationOptions?.quality ?? "low";

    // Mutable code/sceneClass — updated by debug loop
    let currentCode = "";
    let currentSceneClass = "";
    let lastError = "";
    let debugAttempts = 0;
    // Coder-lesson tracking
    let debugInvoked = false;
    let debugResolved = false;
    // True when the LLM pipeline was bypassed and we rendered the guaranteed fallback scene
    let usingFallback = false;
    const originalCodeForReflect = { value: "" };
    const debugHistory: DebugHistoryEntry[] = [];

    // Run one codegen attempt with a given coder config. Records its own
    // agent_code stage and persists the LLM I/O. Returns the response + error string (if any).
    async function runCodeGen(
        coderCfg: LlmRoleConfig,
        attempt: number
    ): Promise<{ response: Awaited<ReturnType<typeof agentClient.code>> | undefined; error: string | undefined }> {
        let err: string | undefined;
        let resp: Awaited<ReturnType<typeof agentClient.code>> | undefined;
        try {
            resp = await withStep(
                jobCtx,
                "agent_code",
                { "scene.index": 0, model: coderCfg.model, voiceover: true, attempt },
                () =>
                    agentClient.code(
                        {
                            prompt: effectivePrompt,
                            examples: ragExamples,
                            requiredApis: ragRequiredApis,
                            requiredPlugins: ragRequiredPlugins,
                            voiceover: true,
                            styleManifest: null,
                            // Complex prompts make a single-shot completion run >120s; give the
                            // agent room (HTTP client waits 330s, see agentClient.code).
                            limits: { timeoutSec: 300 },
                            modelConfig: {
                                coder: coderCfg,
                                validator: modelConfig.validator,
                            },
                            meta: { traceId },
                            coderMemory: coderMemory.length > 0 ? coderMemory : undefined,
                        },
                        traceId
                    ),
                {
                    jobId,
                    stageId: "agent_code",
                    sceneIndex: 0,
                    onSuccess: (r) => {
                        tokens.add(r.tokensUsed, coderCfg.model);
                        const codeTokens = r.tokensUsed
                            ? { input: r.tokensUsed.input, output: r.tokensUsed.output, total: r.tokensUsed.total }
                            : undefined;
                        const cls = r.output?.sceneClass ?? "?";
                        const codeLen = r.output?.code?.length ?? 0;
                        return {
                            tokens: codeTokens,
                            model: coderCfg.model,
                            outputSummary: `${cls} ${codeLen}chars`,
                        };
                    },
                    onFail: () => ({
                        model: coderCfg.model,
                        outputSummary: `code generation failed`,
                    }),
                }
            );
        } catch (codeErr) {
            err = String(codeErr);
        }

        // Persist LLM I/O for this attempt (success OR failure) — best-effort
        void persistLlmIO({
            jobId,
            chatId,
            stage: "agent_code",
            attempt,
            sceneIndex: 0,
            entries: resp?.llmCallLog,
            error: err ?? (!resp?.success ? (resp?.error?.summary) : undefined),
        });

        return { response: resp, error: err };
    }

    const codeIsEmpty = (r: { response: Awaited<ReturnType<typeof agentClient.code>> | undefined; error: string | undefined }) =>
        !!r.error || !r.response?.success || !r.response?.output?.code;

    // Primary codegen attempt
    const codeResult = await runCodeGen(modelConfig.coder, 0);

    const codeResponse = codeResult.response;
    const codeCallError = codeResult.error;

    if (codeIsEmpty(codeResult)) {
        logger.warn({
            message: "[worker] codegen failed — falling back to guaranteed title-card scene",
            jobId, traceId,
            error: codeCallError ?? codeResponse?.error?.summary ?? "unknown",
        });
        currentCode = buildFallbackSceneCode(prompt);
        currentSceneClass = FALLBACK_SCENE_CLASS;
        usingFallback = true;
    } else {
        currentCode = codeResponse!.output!.code!;
        currentSceneClass = codeResponse!.output!.sceneClass;
    }
    // Remember first code for reflection
    originalCodeForReflect.value = currentCode;
    progress("scene_code_complete", "agent_code", { sceneClass: currentSceneClass });

    // ── Step 5: Voiceover — ALWAYS ON, NON-FATAL ─────────────────────────────
    // Extract self.voiceover(text="…") strings from the generated code and
    // synthesize audio via TTS. If TTS throws or yields nothing, log and proceed
    // to render WITHOUT a bundle (render still works, just no narration audio).
    let voiceoverBundle: VoiceoverSpec | undefined;

    const voiceoverTexts = extractVoiceoverTexts(currentCode);
    if (voiceoverTexts.length > 0) {
        phase("voiceover");
        try {
            const voiceoverOpts = {
                provider: generationOptions?.voiceover?.provider,
                voice: generationOptions?.voiceover?.voice,
                lang: generationOptions?.voiceover?.language,
            };
            // One TTS attempt with a given config, bounded by a 90s timeout.
            const synth = (ttsCfg: ResolvedTtsConfig) => Promise.race([
                buildAudioBundle(voiceoverTexts, voiceoverOpts, ttsCfg),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TTS timeout (90s)")), 90_000)),
            ]);
            const audioEntries = await withStep(
                jobCtx,
                "tts",
                { "scene.index": 0, beats: voiceoverTexts.length },
                () => synth(resolvedTtsConfig),
                {
                    jobId,
                    stageId: "tts",
                    sceneIndex: 0,
                    onSuccess: (entries) => ({
                        outputSummary: `${entries.length} beats synthesised`,
                    }),
                    onFail: () => ({ outputSummary: "TTS failed — rendering without audio" }),
                }
            );
            voiceoverBundle = { audio: audioEntries };
        } catch (ttsErr) {
            // NON-FATAL: log and continue without voiceover bundle
            logger.warn({
                message: "[worker] TTS failed (non-fatal); rendering without voiceover",
                traceId,
                error: String(ttsErr),
            });
        }
    } else {
        logger.info({ message: "[worker] no voiceover texts found in generated code; skipping TTS", traceId });
    }

    // ── Cancellation gate ────────────────────────────────────────────────────
    await assertNotCancelled(chatId);

    // ── Steps 6 + 7: Render + debug loop (max 3 debug attempts) ─────────────
    let finalUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let durationSec = 0;
    let renderBytes = 0; // real output size for storage metrics
    let storageKey: string | undefined; // key of the stored final video (used to delete it later)

    // Loop: initial render + up to MAX_DEBUG_ATTEMPTS debug-retry cycles
    // Each cycle: render → on failure → debug → update code → try render again
    for (let attempt = 0; attempt <= MAX_DEBUG_ATTEMPTS; attempt++) {
        phase("render");
        const renderStartedAt = new Date();

        let renderResponse: Awaited<ReturnType<typeof renderClient.render>>;
        try {
            renderResponse = await withStep(
                jobCtx,
                "render",
                { "scene.index": 0, attempt },
                () =>
                    renderClient.render({
                        code: currentCode,
                        sceneClass: currentSceneClass,
                        render: { quality: renderQuality },
                        // Include the voiceover bundle if TTS succeeded.
                        // Reused across debug retries — debugger preserves narration beats.
                        ...(voiceoverBundle ? { voiceover: voiceoverBundle } : {}),
                        storage: {
                            // Render to the service's local store (reachable from the worker
                            // inside docker); the worker then uploads the final video to
                            // API storage below so the URL is reachable from the browser.
                            backend: "local",
                            folder: `stitcher/scenes/${projectId ?? userId}`,
                            public: false,
                            generateThumbnail: true,
                            thumbnailAt: 1,
                        },
                        limits: { timeoutSec: 450 },
                        meta: { traceId },
                    }),
                {
                    jobId,
                    stageId: "render",
                    sceneIndex: 0,
                    // onSuccess not provided — manual rows handle both domain paths below
                    onFail: () => ({
                        failedCode: currentCode.slice(0, 8192),
                        outputSummary: "render service unreachable",
                    }),
                }
            );
        } catch (renderErr) {
            // Render THREW (HTTP 0 / unreachable / pipeline timeout) = an INFRA failure,
            // not a code bug. Debugging or regenerating the code (the latter is what a
            // BullMQ whole-job retry would do) cannot fix an infra timeout and wastes a
            // full RAG + codegen. Skip debug and break to the guaranteed fallback scene
            // below — so infra timeouts yield a title-card video instead of a hard fail,
            // and we never re-spend codegen tokens re-hitting the same timeout.
            lastError = `render service error: ${String(renderErr)}`.slice(0, 300);
            logger.warn({ message: "[worker] render infra error — skipping debug + code regen, going to fallback scene", attempt, traceId, error: String(renderErr) });
            break; // withStep already recorded the failed render stage on throw
        }

        const renderEndedAt = new Date();
        const renderDurationMs = renderEndedAt.getTime() - renderStartedAt.getTime();

        if (renderResponse.success) {
            void appendJobStage(jobId, {
                stage: "render",
                service: "stitcher-render",
                sceneIndex: 0,
                status: "ok",
                startedAt: renderStartedAt,
                endedAt: renderEndedAt,
                durationMs: renderDurationMs,
                outputSummary: `${renderResponse.render.url} ${renderResponse.render.bytes}B ${renderResponse.render.durationSec}s`,
            });
            finalUrl = renderResponse.render.url;
            thumbnailUrl = renderResponse.render.thumbnailUrl;
            durationSec = renderResponse.render.durationSec;
            renderBytes = renderResponse.render.bytes ?? 0;
            void incrementJobScene(jobId);
            progress("scene_render_complete", "render", { url: finalUrl, attempt });
            break; // success — exit loop
        }

        // Render returned success:false (Manim execution error)
        lastError = renderResponse.error.summary;
        void appendJobStage(jobId, {
            stage: "render",
            service: "stitcher-render",
            sceneIndex: 0,
            status: "failed",
            error: `[${renderResponse.error.category}] ${renderResponse.error.summary}\n${renderResponse.error.stderr}`,
            startedAt: renderStartedAt,
            endedAt: renderEndedAt,
            durationMs: renderDurationMs,
            outputSummary: `failed attempt=${attempt} cat=${renderResponse.error.category}`,
            failedCode: currentCode.slice(0, 8192),
        });
        logger.warn({
            message: "[worker] render failed",
            attempt,
            traceId,
            summary: lastError,
        });

        if (attempt >= MAX_DEBUG_ATTEMPTS) {
            break; // exhausted debug budget
        }

        // The fallback scene is known-good; never spend a debug call on it.
        if (usingFallback) break;

        // Debug: ask agent to fix the code, then loop back to render
        debugAttempts++;
        debugInvoked = true;
        phase("debug");
        const codeBeforeDebug = currentCode;
        const errorForDebug = lastError;

        // One debug attempt with a given debugger config.
        const callDebug = async (
            dbgCfg: LlmRoleConfig,
            dbgAttempt: number
        ): Promise<{ resp: Awaited<ReturnType<typeof agentClient.debug>> | undefined; err: string | undefined }> => {
            let dErr: string | undefined;
            let dResp: Awaited<ReturnType<typeof agentClient.debug>> | undefined;
            try {
                dResp = await withStep(
                    jobCtx,
                    "agent_debug",
                    { "scene.index": 0, attempt, model: dbgCfg.model, dbgAttempt },
                    () =>
                        agentClient.debug(
                            {
                                brokenCode: currentCode,
                                sceneClass: currentSceneClass,
                                error: {
                                    stderr: renderResponse.error.stderr,
                                    summary: renderResponse.error.summary,
                                    line: renderResponse.error.line,
                                    category: renderResponse.error.category,
                                },
                                originalPrompt: prompt,
                                modelConfig: {
                                    debugger: dbgCfg,
                                    validator: modelConfig.validator,
                                },
                                // Always keep VoiceoverScene shape + preserve narration beats
                                voiceover: true,
                                meta: { traceId },
                            },
                            traceId
                        ),
                    {
                        jobId,
                        stageId: "agent_debug",
                        sceneIndex: 0,
                        onSuccess: (r) => {
                            tokens.add(r.tokensUsed, dbgCfg.model);
                            const debugTokens = r.tokensUsed
                                ? { input: r.tokensUsed.input, output: r.tokensUsed.output, total: r.tokensUsed.total }
                                : undefined;
                            return {
                                tokens: debugTokens,
                                model: dbgCfg.model,
                                outputSummary: `${r.output?.changeSummary ?? "debugged"}`,
                            };
                        },
                        onFail: () => ({
                            model: dbgCfg.model,
                            outputSummary: `debug call failed`,
                            failedCode: currentCode.slice(0, 8192),
                        }),
                    }
                );
            } catch (debugErr) {
                dErr = String(debugErr);
                logger.warn({
                    message: "[worker] debug call threw (non-fatal); re-rendering with unchanged code",
                    traceId,
                    error: dErr,
                });
            }
            void persistLlmIO({
                jobId,
                chatId,
                stage: "agent_debug",
                attempt,
                sceneIndex: 0,
                entries: dResp?.llmCallLog,
                error: dErr ?? (!dResp?.success ? String(dResp?.error ?? "") : undefined),
            });
            return { resp: dResp, err: dErr };
        };

        const { resp: debugResponse, err: debugCallError } = await callDebug(modelConfig.debugger, 0);

        void debugCallError;

        // Track debug history for reflection
        debugHistory.push({
            code: codeBeforeDebug,
            error: errorForDebug,
            changeSummary: debugResponse?.output?.changeSummary,
        });

        if (debugResponse?.success && debugResponse?.output?.code) {
            currentCode = debugResponse.output.code;
            if (debugResponse.output.sceneClass) {
                currentSceneClass = debugResponse.output.sceneClass;
            }
        }
        // If debug itself failed, the loop continues and hits attempt cap
    }

    // Track whether the debug loop eventually resolved
    if (debugInvoked && !!finalUrl) {
        debugResolved = true;
    }

    // ── Reflection: after debug loop (best-effort, non-fatal) ───────────────
    // If the debug loop ran, ask the agent to reflect and store a CoderLesson.
    if (debugInvoked) {
        try {
            const reflectResponse = await agentClient.reflect(
                {
                    prompt,
                    originalCode: originalCodeForReflect.value,
                    finalError: lastError || undefined,
                    debugHistory,
                    modelConfig: { debugger: modelConfig.debugger },
                },
                traceId
            );

            // Persist the reflect LLM I/O row
            void persistLlmIO({
                jobId,
                chatId,
                stage: "reflect",
                attempt: 0,
                sceneIndex: 0,
                entries: reflectResponse.llmIO,
                error: reflectResponse.success ? undefined : (reflectResponse.error ?? "reflect failed"),
            });

            // Store the lesson if we got one
            if (reflectResponse.success && reflectResponse.lesson) {
                try {
                    await CoderLesson.create({
                        lesson: reflectResponse.lesson,
                        sourcePrompt: prompt.slice(0, 500),
                        error: lastError ? lastError.slice(0, 500) : undefined,
                        fix: debugHistory.length > 0
                            ? (debugHistory[debugHistory.length - 1]?.changeSummary ?? undefined)
                            : undefined,
                        jobId,
                    });
                } catch (lessonErr) {
                    logger.warn({ message: "[worker] CoderLesson persist failed (non-fatal)", jobId, error: String(lessonErr) });
                }
            }
        } catch (reflectErr) {
            logger.warn({ message: "[worker] reflect call failed (non-fatal)", traceId, error: String(reflectErr) });
        }
    }

    // Last-resort fallback render: if real code exhausted debug budget without a
    // successful render, swap in the guaranteed title-card scene and try once more.
    if (!finalUrl && !usingFallback) {
        logger.warn({ message: "[worker] render+debug exhausted — rendering guaranteed fallback scene", jobId, traceId, lastError });
        usingFallback = true;
        currentCode = buildFallbackSceneCode(prompt);
        currentSceneClass = FALLBACK_SCENE_CLASS;
        phase("render");
        const fbStartedAt = new Date();
        const fbResponse = await withStep(
            jobCtx, "render", { "scene.index": 0, attempt: "fallback" },
            () => renderClient.render({
                code: currentCode,
                sceneClass: currentSceneClass,
                render: { quality: renderQuality },
                storage: { backend: "local", folder: `stitcher/scenes/${projectId ?? userId}`, public: false, generateThumbnail: true, thumbnailAt: 1 },
                limits: { timeoutSec: 120 },
                meta: { traceId },
            }),
            { jobId, stageId: "render", sceneIndex: 0, onFail: () => ({ outputSummary: "fallback render failed" }) }
        );
        if (fbResponse.success) {
            finalUrl = fbResponse.render.url;
            thumbnailUrl = fbResponse.render.thumbnailUrl;
            durationSec = fbResponse.render.durationSec;
            renderBytes = fbResponse.render.bytes ?? 0;
            void appendJobStage(jobId, { stage: "render", service: "stitcher-render", sceneIndex: 0, status: "ok", startedAt: fbStartedAt, endedAt: new Date(), durationMs: Date.now() - fbStartedAt.getTime(), outputSummary: `fallback ${finalUrl}` });
            progress("scene_render_complete", "render", { url: finalUrl, attempt: "fallback" });
        } else {
            lastError = fbResponse.error.summary;
        }
    }

    if (!finalUrl) {
        // Persist partial token spend, finalCode, and debug flags before throwing
        try {
            const partialTotal = { input: tokens.acc.input, output: tokens.acc.output, total: tokens.acc.input + tokens.acc.output };
            void setJobTokens(jobId, partialTotal, null);
        } catch { /* instrumentation must not throw */ }
        try {
            await GenerationJob.updateOne(
                { jobId },
                { $set: { finalCode: currentCode || undefined, debugInvoked, debugResolved, usedFallbackScene: usingFallback } }
            );
        } catch { /* non-fatal */ }

        throw new AppError(
            502,
            `Generation failed after ${debugAttempts} debug attempts: ${lastError}`,
            "render_failed"
        );
    }

    // ── Step 7.5: Copy the final video into API storage ──────────────────────
    // The render service keeps its output on its own volume and returns a URL
    // the browser may not reach. Download it and store it through the storage
    // layer (local disk or Cloudinary) so the web app gets a public URL.
    {
        phase("upload");
        const uploadStartedAt = new Date();
        try {
            const stored = await ingestRenderedFile(
                finalUrl,
                `final/${projectId ?? userId}/${chatId}-${Date.now()}.mp4`,
                { contentType: "video/mp4" }
            );
            finalUrl = stored.url;
            thumbnailUrl = stored.thumbnailUrl; // the render service's thumbnail URL is internal; drop it
            renderBytes = stored.bytes || renderBytes;
            storageKey = stored.key;
            void appendJobStage(jobId, {
                stage: "upload", service: "stitcher-api", status: "ok",
                startedAt: uploadStartedAt, endedAt: new Date(),
                durationMs: Date.now() - uploadStartedAt.getTime(),
                outputSummary: finalUrl.slice(0, 80),
            });
            progress("scene_render_complete", "upload", { url: finalUrl });
        } catch (uploadErr) {
            logger.error({ message: "[worker] storing the rendered video failed", jobId, error: String(uploadErr) });
            void appendJobStage(jobId, {
                stage: "upload", service: "stitcher-api", status: "failed",
                startedAt: uploadStartedAt, endedAt: new Date(),
                durationMs: Date.now() - uploadStartedAt.getTime(),
                error: String(uploadErr),
            });
            throw uploadErr instanceof AppError
                ? uploadErr
                : new AppError(502, `Could not store the rendered video: ${String(uploadErr)}`, "storage_failed");
        }
    }

    // ── Step 8: Persist ──────────────────────────────────────────────────────

    // Persist single Asset
    let assetId = "";
    try {
        const asset = new Asset({
            name: `${currentSceneClass}-${chatId}`,
            type: AssetType.VIDEO,
            code: currentCode,
            scene_name: currentSceneClass,
            scene_description: prompt.slice(0, 200),
            origin: AssetOrigin.GENERATED_VIDEO,
            url: finalUrl,
            thumbnail: thumbnailUrl ?? finalUrl,
            duration: durationSec,
            bytes: renderBytes,
            metadata: { traceId, ...(storageKey ? { storageKey } : {}) },
            projectId: new Types.ObjectId(projectId ?? userId),
            isOnTimeline: false,
        });
        await asset.save();
        assetId = (asset._id as Types.ObjectId).toString();
    } catch (assetErr) {
        logger.warn({ message: "[worker] Asset persist failed (non-fatal)", traceId, error: String(assetErr) });
    }

    // Persist final code + debug flags on the GenerationJob (best-effort, non-fatal).
    try {
        const jobUpdate: Record<string, unknown> = {
            finalCode: currentCode,
            debugInvoked,
            debugResolved,
            usedFallbackScene: usingFallback,
        };
        await GenerationJob.updateOne({ jobId }, { $set: jobUpdate });
    } catch { /* non-fatal */ }

    // Update GenerateChat: set finalUrl on the last in-progress assistant message
    await GenerateChat.findByIdAndUpdate(chatId, {
        $set: {
            "messages.$[last].completed": true,
            "messages.$[last].generatorOutput": true,
            "messages.$[last].error": "none",
            "messages.$[last].content.llmResponse": finalUrl,
            "messages.$[last].generationMs": Date.now() - pipelineStartMs,
        },
    }, {
        arrayFilters: [{ "last.role": "assistant", "last.completed": false }],
    });

    // Generated code is not added to the RAG corpus automatically; that needs a manual review step.
    const ragCorpusStored = false;

    // Memory reflection (fire-and-forget)
    reflect(userId, {
        userMessage: prompt,
        assistantMessage: "Generated a single-scene video.",
    }).catch((err) => {
        logger.warn({ message: "[worker] memory reflect failed (non-fatal)", traceId, error: String(err) });
    });

    // Persist token totals
    try {
        const totalTokens = { input: tokens.acc.input, output: tokens.acc.output, total: tokens.acc.input + tokens.acc.output };
        void setJobTokens(jobId, totalTokens, null);
    } catch { /* instrumentation must not throw */ }

    return {
        finalUrl,
        thumbnailUrl,
        durationSec,
        sceneAssets: [{ index: 0, url: finalUrl, assetId }],
        ragCorpusStored,
    };
}

// ─── Worker instance ──────────────────────────────────────────────────────────

export const generationWorker = new Worker<VideoGenerationJobData, VideoGenerationJobResult>(
    "video-generation",
    processGenerationJob,
    {
        connection: redisConnection,
        concurrency: 2,
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

        if (!isRetryable) {
            void setJobStatus(job.id, "failed", { error: String(err), completedAt: new Date() });
        }

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

    void setJobStatus(job.id, "complete", { finalUrl: result.finalUrl, completedAt: new Date() });
});

generationWorker.on("error", (err) => {
    logger.error({ message: "generationWorker error event", error: String(err) });
});
