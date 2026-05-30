/**
 * Render service client — typed HTTP client for the Manim render FastAPI
 * service (default port 8000).  Consumed by the BullMQ worker; never called
 * directly from request handlers.
 *
 * Key design notes:
 *   - render() does NOT throw on `success:false` — that's a domain result.
 *     It only throws ServiceError on transport failures (timeout, 503, 5xx).
 *   - 503 surfaces ServiceError with `retryAfter` seconds from the
 *     Retry-After header so the worker can re-queue with a delay.
 *   - Default axios timeout is 600 s; can be overridden per-call via
 *     input.limits.timeoutSec (an additional layer on top of axios timeout).
 *
 * No retry logic — BullMQ handles that at the job level.
 */

import axios from "axios";
import { config } from "../config";
import logger from "../util/logger.util";
import { toServiceError } from "./ServiceError";

// ─── Public types ─────────────────────────────────────────────────────────────

export type RenderQuality = "low" | "medium" | "high" | "production" | "fourk";
export type VideoFormat = "mp4" | "webm" | "mov" | "gif" | "png" | "svg";
export type RenderBackend = "cairo" | "opengl";
export type StorageBackend = "local" | "cloudinary" | "s3" | "gcs" | "azure";

export interface RenderSpec {
    quality: RenderQuality;
    fps?: number;
    resolution?: [number, number];
    format?: VideoFormat;
    backend?: RenderBackend;
    transparent?: boolean;
    background?: string;
    frameRange?: [number, number];
}

export interface AudioSpec {
    base64: string;
    filename?: string;
    offset?: number;
    gain?: number;
}

export interface StorageSpec {
    backend: StorageBackend;
    folder?: string;
    public?: boolean;
    generateThumbnail?: boolean;
    thumbnailAt?: number;
}

export interface LimitSpec {
    timeoutSec?: number;
    memoryMb?: number;
    cpuCount?: number;
}

/**
 * Native voiceover bundle (contract: separate from the top-level `audio`
 * post-mux field). One pre-generated mp3 per distinct narration beat, keyed by
 * sha256(normalizeText(beat)) hex (see ttsClient.cacheKey). The render service
 * stages each entry to `<workdir>/media/voiceovers/<key>.mp3` BEFORE manim runs,
 * where OfflineTTS finds it. Audio is baked by manim via add_sound — NOT muxed.
 */
export interface VoiceoverEntry {
    key: string;
    base64: string;
}

export interface VoiceoverSpec {
    audio: VoiceoverEntry[];
}

export interface RenderInput {
    code: string;
    sceneClass: string;
    render?: RenderSpec;
    audio?: AudioSpec;
    voiceover?: VoiceoverSpec;
    storage: StorageSpec;
    limits?: LimitSpec;
    meta: { traceId: string };
}

// ── Response sub-types ───────────────────────────────────────────────────────

export interface RenderOutputPayload {
    url: string;
    thumbnailUrl?: string;
    format: VideoFormat;
    durationSec: number;
    width: number;
    height: number;
    fps: number;
    bytes: number;
    codec?: string;
    hasAudio: boolean;
}

export interface RenderErrorPayload {
    phase: string;
    category: string;
    summary: string;
    stderr: string;
    stdout: string;
    traceback?: string;
    line?: number;
    exitCode?: number;
    killedBy?: string;
}

export interface RenderExecutionInfo {
    sandboxSetupMs: number;
    renderMs: number;
    uploadMs: number;
    totalMs: number;
    manimVersion?: string;
    sandbox: string;
}

/**
 * Union type matching both the success and failure response from POST /render.
 * The HTTP status is always 200 — inspect `success` to branch.
 */
export type RenderResponse =
    | {
          success: true;
          render: RenderOutputPayload;
          execution: RenderExecutionInfo;
          meta: Record<string, unknown>;
          error?: undefined;
          echo?: undefined;
      }
    | {
          success: false;
          error: RenderErrorPayload;
          echo: { code: string; sceneClass: string };
          execution: RenderExecutionInfo;
          meta: Record<string, unknown>;
          render?: undefined;
      };

// ── Health / capabilities ────────────────────────────────────────────────────

export interface RenderCheckResult {
    ok: boolean;
    version?: string;
    latencyMs?: number;
    freeMb?: number;
    tool?: string;
    backend?: string;
    active?: number;
    max?: number;
    detail?: string;
}

export interface RenderHealthResponse {
    status: "ok" | "degraded" | "down";
    checks: Record<string, RenderCheckResult>;
}

export interface RenderLimits {
    maxCodeBytes: number;
    maxAudioBytes: number;
    maxTimeoutSec: number;
}

export interface RenderCapabilitiesResponse {
    manimVersion?: string;
    ffmpegVersion?: string;
    latexAvailable: boolean;
    backends: RenderBackend[];
    qualities: RenderQuality[];
    formats: VideoFormat[];
    storage: StorageBackend[];
    sandbox: string;
    maxConcurrent: number;
    limits: RenderLimits;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const SERVICE = "render";
const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes — render is synchronous and slow

// Use ReturnType to avoid relying on named AxiosInstance export
type HttpClient = ReturnType<typeof axios.create>;

class RenderClient {
    private readonly http: HttpClient;

    constructor() {
        this.http = axios.create({
            baseURL: config.RENDER_SERVICE_URL,
            timeout: DEFAULT_TIMEOUT_MS,
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": config.RENDER_API_KEY,
            },
        });
    }

    private traceHeaders(traceId?: string): Record<string, string> {
        return traceId ? { "X-Trace-Id": traceId } : {};
    }

    /**
     * POST /render
     *
     * Synchronous render call.  May take minutes.
     *
     * Does NOT throw on `success:false` (Manim execution failed but the HTTP
     * call succeeded) — the caller inspects the `success` discriminant.
     *
     * Throws ServiceError on:
     *   - axios timeout (status 0)
     *   - 503 Semaphore saturated (includes retryAfter from Retry-After header)
     *   - any other 4xx/5xx transport error
     *
     * Timeout: uses `input.limits.timeoutSec` if provided (converts to ms),
     * otherwise falls back to the 600 s instance default.
     */
    async render(input: RenderInput): Promise<RenderResponse> {
        const traceId = input.meta.traceId;
        logger.debug(`[render] render traceId=${traceId} sceneClass=${input.sceneClass} quality=${input.render?.quality ?? "default"}`);

        // Override per-call timeout when the caller supplies a limit.
        // The field is in seconds; axios expects milliseconds.
        const timeoutMs = input.limits?.timeoutSec
            ? input.limits.timeoutSec * 1_000
            : DEFAULT_TIMEOUT_MS;

        try {
            const res = await this.http.post<RenderResponse>("/render", input, {
                headers: this.traceHeaders(traceId),
                timeout: timeoutMs,
                // 200 = both success and domain-level render failure — always ok
                // 503 = semaphore saturated — NOT ok; let axios treat as error so
                //       toServiceError can pick up the Retry-After header
                validateStatus: (s: number) => s === 200,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── GET /health ──────────────────────────────────────────────────────────

    async health(): Promise<RenderHealthResponse> {
        try {
            const res = await this.http.get<RenderHealthResponse>("/health", {
                timeout: 5_000,
                validateStatus: (s: number) => s === 200 || s === 503,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    // ── GET /capabilities ────────────────────────────────────────────────────

    async capabilities(): Promise<RenderCapabilitiesResponse> {
        try {
            const res = await this.http.get<RenderCapabilitiesResponse>("/capabilities", {
                timeout: 5_000,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const renderClient = new RenderClient();

export { ServiceError } from "./ServiceError";
