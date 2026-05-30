/**
 * Agent service client — typed HTTP client for the Manim Agent Fastify service
 * (default port 4000).  Consumed by the BullMQ worker; never called directly
 * from request handlers.
 *
 * Timeouts per endpoint:
 *   /plan, /code          60 s  (LLM-heavy)
 *   /debug                30 s
 *   /health, /capabilities,
 *   /jobs/:id, /cancel     5 s
 *   /generate             60 s  (fire-and-forget 202 path)
 *   streamEvents          none  (streaming)
 *
 * No retry logic — BullMQ handles that at the job level.
 */

import axios from "axios";
import { Readable } from "stream";
import { config } from "../config";
import logger from "../util/logger.util";
import { toServiceError } from "./ServiceError";

// ─── Shared LLM role config ───────────────────────────────────────────────────

export interface LlmRoleConfig {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    /**
     * Per-request API key. Field name matches the agent service's
     * ModelConfigSchema (apiKey) and its factory getModel(cfg.apiKey) exactly,
     * so a user's BYOK key reaches the provider rather than being stripped by
     * the agent's Zod parse.
     */
    apiKey?: string;
    /** Per-request base URL override; matches the agent's ModelConfigSchema. */
    baseURL?: string;
}

// ─── /plan types ─────────────────────────────────────────────────────────────

export interface UserPreferences {
    primaryColor?: string;
    backgroundColor?: string;
    animationPace?: "slow" | "medium" | "fast";
    complexityLevel?: "beginner" | "intermediate" | "advanced";
    preferredDomain?: string;
}

export interface PlanConstraints {
    minScenes?: number;
    maxScenes?: number;
    maxSceneDurationSec?: number;
    targetTotalDurationSec?: number;
    renderQualityHint?: "low" | "medium" | "high";
}

export interface SceneSpec {
    index: number;
    prompt: string;
    durationSec: number;
    manimFeatures: string[];
    requiredSymbols: string[];
    description?: string;
    concepts?: string[];
    visualElements?: string[];
    /**
     * Native voiceover: ordered narration beat strings the planner emits when
     * voiceover is ON (plan-authoritative). The coder reproduces each verbatim
     * inside a `self.voiceover(text=...)` block, and the worker pre-synthesizes
     * audio for these EXACT beats in parallel with code-gen. Absent/empty when
     * voiceover is OFF.
     */
    narration?: string[];
}

export interface StyleManifest {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    accentColor: string;
    fontFamily: string;
    animationPace: "slow" | "medium" | "fast";
    positioningZones: Record<string, string>;
    elementNaming: Record<string, string>;
}

export interface PlanInput {
    prompt: string;
    modelConfig?: {
        planner?: LlmRoleConfig;
    };
    userPreferences?: UserPreferences;
    styleManifestOverride?: unknown;
    constraints?: PlanConstraints;
    limits?: { timeoutSec?: number };
    /** When true, the planner emits `narration[]` per scene (plan-authoritative). */
    voiceover?: boolean;
    meta?: { traceId?: string };
}

export interface PlanResponse {
    success: boolean;
    jobId: string;
    output: {
        scenes: SceneSpec[];
        styleManifest: StyleManifest;
    } | null;
    error: { summary: string } | null;
}

// ─── /code types ─────────────────────────────────────────────────────────────

export interface CodeExample {
    description: string;
    code: string;
}

export interface CodeInput {
    scenePlan: SceneSpec;
    styleManifest: StyleManifest;
    codeExamples?: CodeExample[];
    modelConfig?: {
        coder?: LlmRoleConfig;
        validator?: LlmRoleConfig;
    };
    limits?: { maxValidationRetries?: number; timeoutSec?: number };
    /**
     * When true, the coder emits a `VoiceoverScene` with one
     * `self.voiceover(text=...)` block per planned narration beat (verbatim), and
     * the validator enforces the beats match `scenePlan.narration`.
     */
    voiceover?: boolean;
    meta?: { traceId?: string };
}

export interface CodeOutput {
    sceneIndex: number;
    sceneClass: string;
    code: string | undefined;
    status: string;
    attempts?: unknown[];
}

export interface CodeResponse {
    success: boolean;
    jobId: string;
    output: CodeOutput | null;
    error: { summary: string } | null;
}

// ─── /debug types ────────────────────────────────────────────────────────────

export interface DebugError {
    stderr: string;
    summary: string;
    line?: number;
    category?: string;
}

export interface DebugInput {
    brokenCode: string;
    sceneClass?: string;
    error: DebugError;
    originalPrompt?: string;
    previousAttempts?: Array<{ code: string; error: string }>;
    modelConfig?: {
        debugger?: LlmRoleConfig;
        validator?: LlmRoleConfig;
    };
    limits?: { maxValidationRetries?: number; timeoutSec?: number };
    /**
     * When true, the debugger keeps the `VoiceoverScene` shape and PRESERVES the
     * narration beats verbatim (so the pre-synthesized audio bundle still
     * resolves — the worker reuses the same bundle without re-synthesizing).
     */
    voiceover?: boolean;
    meta?: { traceId?: string };
}

export interface DebugResponse {
    success: boolean;
    jobId: string;
    output: {
        sceneClass?: string;
        code: string;
        changeSummary?: string;
        diff?: string;
        validation?: unknown;
    } | null;
    error: unknown;
}

// ─── /generate types ─────────────────────────────────────────────────────────

export interface RetrievalContext {
    apiExamples?: Array<{ symbol: string; snippet: string }>;
    similarScripts?: Array<{ prompt: string; code: string }>;
    styleRecommendations?: string[];
    pitfalls?: string[];
}

export interface GenerateInput {
    prompt: string;
    modelConfig?: {
        planner?: LlmRoleConfig;
        coder?: LlmRoleConfig;
        debugger?: LlmRoleConfig;
        validator?: LlmRoleConfig;
    };
    context?: {
        retrievalContext?: RetrievalContext;
        userPreferences?: UserPreferences;
        styleManifestOverride?: unknown;
    };
    constraints?: PlanConstraints;
    limits?: { maxValidationRetries?: number; timeoutSec?: number };
    meta?: { traceId?: string };
}

export interface GenerateAsyncResponse {
    jobId: string;
    streamUrl: string;
    syncUrl: string;
}

// ─── /jobs types ─────────────────────────────────────────────────────────────

export type JobStateResponse = Record<string, unknown>;

// ─── SSE types ───────────────────────────────────────────────────────────────

export interface AgentEvent {
    event: string;
    data: unknown;
    id?: string;
}

// ─── /health and /capabilities types ─────────────────────────────────────────

export interface AgentHealthResponse {
    status: string;
    checks?: Record<string, unknown>;
    version?: string;
}

export interface AgentCapabilitiesResponse {
    providers?: unknown;
    tools?: unknown;
    limits?: unknown;
    [key: string]: unknown;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const SERVICE = "agent";

// Use ReturnType to avoid relying on named AxiosInstance export
type HttpClient = ReturnType<typeof axios.create>;

class AgentClient {
    private readonly http: HttpClient;

    constructor() {
        this.http = axios.create({
            baseURL: config.AGENT_SERVICE_URL,
            // Most methods override per-call; set a safe fallback
            timeout: 60_000,
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": config.AGENT_API_KEY,
            },
        });
    }

    /** Build per-call config overrides (trace header + timeout) */
    private callCfg(traceId?: string, timeoutMs?: number) {
        return {
            headers: traceId ? { "X-Trace-Id": traceId } : undefined,
            timeout: timeoutMs,
        };
    }

    // ── POST /plan ───────────────────────────────────────────────────────────

    async plan(input: PlanInput, traceId?: string): Promise<PlanResponse> {
        logger.debug(`[agent] plan traceId=${traceId ?? "-"} prompt="${input.prompt.slice(0, 80)}"`);
        try {
            const res = await this.http.post<PlanResponse>("/plan", input, this.callCfg(traceId, 60_000));
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── POST /code ───────────────────────────────────────────────────────────

    async code(input: CodeInput, traceId?: string): Promise<CodeResponse> {
        logger.debug(`[agent] code traceId=${traceId ?? "-"} sceneIndex=${input.scenePlan.index}`);
        try {
            const res = await this.http.post<CodeResponse>("/code", input, this.callCfg(traceId, 60_000));
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── POST /debug ──────────────────────────────────────────────────────────

    async debug(input: DebugInput, traceId?: string): Promise<DebugResponse> {
        logger.debug(`[agent] debug traceId=${traceId ?? "-"} sceneClass=${input.sceneClass ?? "-"}`);
        try {
            const res = await this.http.post<DebugResponse>("/debug", input, this.callCfg(traceId, 30_000));
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── POST /generate (202 only) ────────────────────────────────────────────

    async generate(input: GenerateInput, traceId?: string): Promise<GenerateAsyncResponse> {
        logger.debug(`[agent] generate traceId=${traceId ?? "-"} prompt="${input.prompt.slice(0, 80)}"`);
        try {
            const res = await this.http.post<GenerateAsyncResponse>("/generate", input, {
                ...this.callCfg(traceId, 60_000),
                validateStatus: (s: number) => s === 202,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── GET /jobs/:jobId ─────────────────────────────────────────────────────

    async getJob(jobId: string): Promise<JobStateResponse> {
        logger.debug(`[agent] getJob jobId=${jobId}`);
        try {
            const res = await this.http.get<JobStateResponse>(`/jobs/${jobId}`, this.callCfg(undefined, 5_000));
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    // ── POST /jobs/:jobId/cancel ─────────────────────────────────────────────

    async cancelJob(jobId: string): Promise<{ cancelled: boolean; jobId: string }> {
        logger.debug(`[agent] cancelJob jobId=${jobId}`);
        try {
            const res = await this.http.post<{ cancelled: boolean; jobId: string }>(
                `/jobs/${jobId}/cancel`,
                {},
                this.callCfg(undefined, 5_000)
            );
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    // ── GET /health ──────────────────────────────────────────────────────────

    async health(): Promise<AgentHealthResponse> {
        try {
            const res = await this.http.get<AgentHealthResponse>("/health", {
                ...this.callCfg(undefined, 5_000),
                validateStatus: (s: number) => s === 200 || s === 503,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    // ── GET /capabilities ────────────────────────────────────────────────────

    async capabilities(): Promise<AgentCapabilitiesResponse> {
        try {
            const res = await this.http.get<AgentCapabilitiesResponse>("/capabilities", this.callCfg(undefined, 5_000));
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    /**
     * Stream SSE events from GET /stream/:jobId.
     *
     * Yields AgentEvent objects until the server closes the connection.
     * Uses axios with responseType:'stream' and a minimal SSE line parser —
     * no external eventsource library needed.
     *
     * Design decisions:
     *   - No timeout (streaming; connection lives until server closes it).
     *   - No reconnect/replay on disconnect — worker rebuilds iterator on retry.
     *   - Throws ServiceError on HTTP-level failure (non-2xx before stream starts).
     *   - Throws ServiceError on stream error events.
     */
    async *streamEvents(jobId: string, traceId?: string): AsyncIterable<AgentEvent> {
        logger.debug(`[agent] streamEvents jobId=${jobId} traceId=${traceId ?? "-"}`);

        let stream: Readable;

        try {
            const res = await this.http.get<Readable>(`/stream/${jobId}`, {
                responseType: "stream",
                timeout: 0, // no timeout for SSE streams
                headers: traceId ? { "X-Trace-Id": traceId } : undefined,
            });
            stream = res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }

        yield* parseSseStream(stream, SERVICE, traceId);
    }
}

// ─── Minimal SSE parser ───────────────────────────────────────────────────────

/**
 * Parse a Node.js Readable stream in SSE format and yield AgentEvent objects.
 * Handles multi-line `data:` fields by joining with newlines.
 *
 * SSE format:
 *   event: <name>\n
 *   id: <id>\n
 *   data: <json or string>\n
 *   \n        ← blank line dispatches the event
 */
// Exported for unit testing (parseSseStream.test in agentClient.test.ts).
// It is a pure stream transformer with no side-effects; exporting it is safe.
export async function* parseSseStream(
    stream: Readable,
    service: string,
    traceId?: string
): AsyncIterable<AgentEvent> {
    let buffer = "";
    let eventType = "message";
    let eventId: string | undefined;
    let dataLines: string[] = [];

    const chunks = stream as AsyncIterable<Buffer | string>;

    try {
        for await (const chunk of chunks) {
            buffer += typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8");

            // Process all complete lines in the buffer
            let newline: number;
            while ((newline = buffer.indexOf("\n")) !== -1) {
                const raw = buffer.slice(0, newline).replace(/\r$/, "");
                buffer = buffer.slice(newline + 1);

                if (raw === "") {
                    // Blank line — dispatch event if we have data
                    if (dataLines.length > 0) {
                        const dataStr = dataLines.join("\n");
                        let parsed: unknown = dataStr;
                        try {
                            parsed = JSON.parse(dataStr);
                        } catch {
                            // leave as raw string
                        }

                        yield {
                            event: eventType,
                            data: parsed,
                            id: eventId,
                        };
                    }

                    // Reset per-event fields
                    eventType = "message";
                    eventId = undefined;
                    dataLines = [];
                } else if (raw.startsWith("event:")) {
                    eventType = raw.slice(6).trim();
                } else if (raw.startsWith("id:")) {
                    eventId = raw.slice(3).trim();
                } else if (raw.startsWith("data:")) {
                    dataLines.push(raw.slice(5).trimStart());
                }
                // ignore `retry:` and comment lines (`:`)
            }
        }

        // Process any remaining un-newline-terminated content in the buffer.
        // This handles the case where the stream ends mid-line (no trailing \n).
        if (buffer.length > 0) {
            const raw = buffer.replace(/\r$/, "");
            if (raw.startsWith("event:")) {
                eventType = raw.slice(6).trim();
            } else if (raw.startsWith("id:")) {
                eventId = raw.slice(3).trim();
            } else if (raw.startsWith("data:")) {
                dataLines.push(raw.slice(5).trimStart());
            }
        }

        // Dispatch any trailing buffered event (stream closed without final blank line)
        if (dataLines.length > 0) {
            const dataStr = dataLines.join("\n");
            let parsed: unknown = dataStr;
            try {
                parsed = JSON.parse(dataStr);
            } catch {
                // leave as raw string
            }
            yield { event: eventType, data: parsed, id: eventId };
        }
    } catch (err) {
        throw toServiceError(service, err, traceId);
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const agentClient = new AgentClient();

export { ServiceError } from "./ServiceError";
