/**
 * Per-request settings resolution.
 *
 * Everything except the embedder (which is index-locked and stays env-side) can
 * be overridden per request: stage toggles, retrieval tuning, timeouts, the LLM
 * and reranker model/baseUrl/reasoning-params, and BYO API keys. resolveSettings
 * merges env defaults with the request's overrides into a ResolvedSettings object
 * that is threaded through the pipeline — no stage reads the global config.
 */

import { config } from "../config.js";
import type { LlmTarget } from "../providers/llm.js";

// ─── Request-facing shapes (all optional) ──────────────────────────────────

export interface LlmTargetOverride {
  model?: string;
  baseUrl?: string;
  /** Provider-specific body params, merged verbatim (e.g. reasoning/thinking). */
  extraBody?: Record<string, unknown>;
}

export interface RequestOverrides {
  stages?: {
    queryTransform?: boolean;
    sparse?: boolean;
    rerank?: boolean;
    pitfalls?: boolean;
  };
  retrieval?: {
    denseTopK?: number;
    denseNumCandidates?: number;
    sparseTopK?: number;
    rerankCandidates?: number;
    rerankDocChars?: number;
    rerankTopN?: number;
    rrfK?: number;
  };
  timeouts?: {
    queryTransformMs?: number;
    vectorSearchMs?: number;
    rerankMs?: number;
  };
  llm?: LlmTargetOverride;
  reranker?: LlmTargetOverride;
  defaultTopK?: number;
}

/** BYO keys, supplied via headers (never the body) so they don't get logged. */
export interface ByoKeys {
  llmKey?: string;
  rerankerKey?: string;
}

// ─── Fully-resolved settings for one request ───────────────────────────────

export interface ResolvedSettings {
  stages: { queryTransform: boolean; sparse: boolean; rerank: boolean; pitfalls: boolean };
  retrieval: {
    denseTopK: number;
    denseNumCandidates: number;
    sparseTopK: number;
    rerankCandidates: number;
    rerankDocChars: number;
    rerankTopN: number;
    rrfK: number;
  };
  timeouts: { queryTransformMs: number; vectorSearchMs: number; rerankMs: number };
  llm: LlmTarget;
  reranker: LlmTarget;
  defaultTopK: number;
}

/** Default reasoning/thinking params when the request doesn't specify extraBody. */
function defaultExtraBody(): Record<string, unknown> {
  return config.OPENCODE_DISABLE_THINKING ? { thinking: { type: "disabled" } } : {};
}

/** Validate an overridden baseUrl: must be http(s) and (if configured) allow-listed. */
function validateBaseUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid baseUrl: ${url}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`baseUrl must be http(s): ${url}`);
  }
  const allow = config.ALLOWED_LLM_BASE_URLS.split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length > 0 && !allow.some((a) => url.startsWith(a))) {
    throw new Error(`baseUrl not in ALLOWED_LLM_BASE_URLS: ${url}`);
  }
}

/** Merge env defaults with request overrides + BYO keys. Throws on bad baseUrl. */
export function resolveSettings(ov: RequestOverrides = {}, keys: ByoKeys = {}): ResolvedSettings {
  if (ov.llm?.baseUrl) validateBaseUrl(ov.llm.baseUrl);
  if (ov.reranker?.baseUrl) validateBaseUrl(ov.reranker.baseUrl);

  return {
    stages: {
      queryTransform: ov.stages?.queryTransform ?? config.STAGE_QUERY_TRANSFORM,
      sparse: ov.stages?.sparse ?? config.STAGE_SPARSE,
      rerank: ov.stages?.rerank ?? config.STAGE_RERANK,
      pitfalls: ov.stages?.pitfalls ?? config.STAGE_PITFALLS,
    },
    retrieval: {
      denseTopK: ov.retrieval?.denseTopK ?? config.DENSE_TOP_K,
      denseNumCandidates: ov.retrieval?.denseNumCandidates ?? config.DENSE_NUM_CANDIDATES,
      sparseTopK: ov.retrieval?.sparseTopK ?? config.SPARSE_TOP_K,
      rerankCandidates: ov.retrieval?.rerankCandidates ?? config.RERANK_CANDIDATES,
      rerankDocChars: ov.retrieval?.rerankDocChars ?? config.RERANK_DOC_CHARS,
      rerankTopN: ov.retrieval?.rerankTopN ?? config.RERANKER_TOP_N,
      rrfK: ov.retrieval?.rrfK ?? config.RRF_K,
    },
    timeouts: {
      queryTransformMs: ov.timeouts?.queryTransformMs ?? config.QUERY_TRANSFORM_TIMEOUT_MS,
      vectorSearchMs: ov.timeouts?.vectorSearchMs ?? config.VECTOR_SEARCH_TIMEOUT_MS,
      rerankMs: ov.timeouts?.rerankMs ?? config.RERANK_TIMEOUT_MS,
    },
    llm: {
      apiKey: keys.llmKey || config.LLM_API_KEY,
      model: ov.llm?.model ?? config.LLM_MODEL,
      baseUrl: ov.llm?.baseUrl ?? config.OPENCODE_GO_BASE_URL,
      extraBody: ov.llm?.extraBody ?? defaultExtraBody(),
    },
    reranker: {
      apiKey: keys.rerankerKey || config.RERANKER_API_KEY || config.LLM_API_KEY,
      model: ov.reranker?.model ?? config.RERANKER_MODEL,
      baseUrl: ov.reranker?.baseUrl ?? config.OPENCODE_GO_BASE_URL,
      extraBody: ov.reranker?.extraBody ?? defaultExtraBody(),
    },
    defaultTopK: ov.defaultTopK ?? config.DEFAULT_TOP_K,
  };
}
