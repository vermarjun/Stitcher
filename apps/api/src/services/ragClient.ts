/**
 * RAG service client — typed HTTP client for the ManimRAG Fastify service
 * (default port 7000).  Consumed by the BullMQ worker; never called directly
 * from request handlers.
 *
 * All auth'd calls set X-Api-Key. A per-call optional traceId is forwarded
 * as X-Trace-Id.  No retry logic — BullMQ handles that at the job level.
 */

import axios from "axios";
import { config } from "../config";
import logger from "../util/logger.util";
import { ServiceError, toServiceError } from "./ServiceError";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EnhanceInput {
    prompt: string;
    options?: {
        topK?: number;
        strategy?: string;
    };
    llmConfig?: Record<string, unknown>;
}

export interface ApiExample {
    symbol: string;
    category: string;
    snippet: string;
    docstring: string;
    source: string;
    score?: number;
    originalPrompt?: string;
    apisUsed?: string[];
    animationTypes?: string[];
    domain?: string;
    complexity?: string;
    manimVersion?: string;
    colorPalette?: string[];
    similarity?: number;
}

export interface EnhanceResponse {
    groundedPrompt: string;
    structuredContext: {
        apiExamples: ApiExample[];
        similarScripts: unknown[];
        styleRecommendations: unknown[];
        pitfalls: unknown[];
    };
    retrievalTrace: {
        denseCandidates: number;
        sparseCandidates: number;
        mergedCandidates: number;
        afterRerank: number;
        embedModel: string;
        rerankModel: string;
        store: string;
        phase: number;
    };
    execution: {
        totalMs: number;
        queryTransformMs: number;
        embeddingMs: number;
        vectorSearchMs: number;
        rerankMs: number;
        hydeMs: number;
        synthesisMs: number;
        llmCalls: number;
    };
}

export interface CorpusDocument {
    id?: string;
    parent?: Record<string, unknown>;
    child?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface CorpusAddInput {
    documents: CorpusDocument[];
}

export interface CorpusAddResult {
    id: string;
    success: boolean;
    error?: string;
}

export interface CorpusAddResponse {
    results: CorpusAddResult[];
    /** true when all documents succeeded (HTTP 200); false on partial (HTTP 207) */
    allSucceeded: boolean;
}

export interface CorpusStatsResponse {
    count: number;
    source: string;
    note: string;
}

export interface RagHealthResponse {
    status: string;
    checks: Record<string, unknown>;
    version: string;
}

export interface RagCapabilitiesResponse {
    version: string;
    phase: number;
    supportedVectorStores: string[];
    supportedEmbedders: string[];
    supportedRerankers: string[];
    supportedLlmProviders: string[];
    strategies: string[];
    defaultTopK: number;
    notes: string[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

const SERVICE = "rag";
const DEFAULT_TIMEOUT_MS = 30_000;

// Use ReturnType to avoid relying on named AxiosInstance export
type HttpClient = ReturnType<typeof axios.create>;

class RagClient {
    private readonly http: HttpClient;

    constructor() {
        this.http = axios.create({
            baseURL: config.RAG_SERVICE_URL,
            timeout: DEFAULT_TIMEOUT_MS,
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": config.RAG_API_KEY,
            },
        });
    }

    private traceHeaders(traceId?: string): Record<string, string> {
        return traceId ? { "X-Trace-Id": traceId } : {};
    }

    // ── POST /enhance ────────────────────────────────────────────────────────

    async enhance(input: EnhanceInput, traceId?: string): Promise<EnhanceResponse> {
        logger.debug(`[rag] enhance traceId=${traceId ?? "-"} prompt="${input.prompt.slice(0, 80)}"`);
        try {
            const res = await this.http.post<EnhanceResponse>("/enhance", input, {
                headers: this.traceHeaders(traceId),
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── POST /corpus/add ─────────────────────────────────────────────────────

    async corpusAdd(input: CorpusAddInput, traceId?: string): Promise<CorpusAddResponse> {
        logger.debug(`[rag] corpusAdd traceId=${traceId ?? "-"} count=${input.documents.length}`);
        try {
            // 207 = partial success — treat as success, let caller inspect per-doc results
            const res = await this.http.post<{ results: CorpusAddResult[] }>(
                "/corpus/add",
                input,
                {
                    headers: this.traceHeaders(traceId),
                    validateStatus: (s: number) => s === 200 || s === 207,
                }
            );
            return {
                results: res.data.results,
                allSucceeded: res.status === 200,
            };
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── GET /corpus/stats ────────────────────────────────────────────────────

    async corpusStats(traceId?: string): Promise<CorpusStatsResponse> {
        logger.debug(`[rag] corpusStats traceId=${traceId ?? "-"}`);
        try {
            const res = await this.http.get<CorpusStatsResponse>("/corpus/stats", {
                headers: this.traceHeaders(traceId),
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err, traceId);
        }
    }

    // ── GET /health ──────────────────────────────────────────────────────────

    async health(): Promise<RagHealthResponse> {
        try {
            const res = await this.http.get<RagHealthResponse>("/health", {
                timeout: 5_000,
                // 503 from health is informational, not a transport error
                validateStatus: (s: number) => s === 200 || s === 503,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }

    // ── GET /capabilities ────────────────────────────────────────────────────

    async capabilities(): Promise<RagCapabilitiesResponse> {
        try {
            const res = await this.http.get<RagCapabilitiesResponse>("/capabilities", {
                timeout: 5_000,
            });
            return res.data;
        } catch (err) {
            throw toServiceError(SERVICE, err);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const ragClient = new RagClient();

// Re-export error type so callers only need one import
export { ServiceError };
