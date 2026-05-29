import { z } from "zod";

// Load .env if present (no-op if already set by the runtime)
import { config as loadDotenv } from "dotenv";
loadDotenv();

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse a boolean-ish env string ("1"/"true"/"yes"/"on" → true). */
function boolEnv(def: boolean) {
  return z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
    return def;
  }, z.boolean());
}

const ConfigSchema = z.object({
  // ─── MongoDB / vector store ──────────────────────────────────────────────
  MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),
  MONGODB_DB_NAME: z.string().default("manimrag"),
  VECTOR_STORE: z.enum(["mongodb_atlas"]).default("mongodb_atlas"),
  COLLECTION_NAME: z.string().default("manimrag_corpus"),
  VECTOR_INDEX_NAME: z.string().default("manimrag_vector_index"),
  TEXT_INDEX_NAME: z.string().default("manimrag_text_index"),

  // ─── Embedder (Gemini) ───────────────────────────────────────────────────
  EMBEDDER_PROVIDER: z.string().default("gemini"),
  // Single key (back-compat) OR a comma-separated list rotated across requests.
  EMBEDDER_API_KEY: z.string().default(""),
  EMBEDDER_API_KEYS: z.string().default(""),
  EMBEDDER_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIM: z.coerce.number().int().positive().max(4096).default(3072),
  EMBED_BATCH_SIZE: z.coerce.number().int().positive().max(250).default(100),
  GEMINI_BASE_URL: z
    .string()
    .default("https://generativelanguage.googleapis.com/v1beta"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),

  // ─── Query-transform LLM (must support tool_choice → glm-5.1/kimi) ────────
  LLM_PROVIDER: z.string().default("opencode"),
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_MODEL: z.string().default("glm-5.1"),
  OPENCODE_GO_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1"),
  // OpenCode-Go models default to "thinking" mode (slow). Sending
  // thinking:{type:"disabled"} turns it off (~5x faster) — verified to keep
  // tool_choice working on glm-5.1 and clean JSON on deepseek-v4-flash.
  OPENCODE_DISABLE_THINKING: boolEnv(true),
  // Optional SSRF guard for per-request llm/reranker baseUrl overrides:
  // comma-separated allowed prefixes. Empty = allow any (dev convenience).
  ALLOWED_LLM_BASE_URLS: z.string().default(""),

  // ─── Reranker (plain completion, high-quota model) ───────────────────────
  RERANKER_PROVIDER: z.string().default("opencode"),
  RERANKER_API_KEY: z.string().default(""),
  RERANKER_MODEL: z.string().default("deepseek-v4-flash"),
  RERANKER_TOP_N: z.coerce.number().int().positive().default(5),

  // ─── Pipeline stage toggles (opt-in at runtime) ──────────────────────────
  STAGE_QUERY_TRANSFORM: boolEnv(true),
  STAGE_SPARSE: boolEnv(false),
  STAGE_RERANK: boolEnv(true),
  STAGE_PITFALLS: boolEnv(true),

  // ─── Retrieval tuning ────────────────────────────────────────────────────
  DEFAULT_TOP_K: z.coerce.number().int().positive().default(5),
  DENSE_TOP_K: z.coerce.number().int().positive().default(40),
  DENSE_NUM_CANDIDATES: z.coerce.number().int().positive().default(200),
  SPARSE_TOP_K: z.coerce.number().int().positive().default(40),
  RERANK_CANDIDATES: z.coerce.number().int().positive().default(20),
  RERANK_DOC_CHARS: z.coerce.number().int().positive().default(600),
  RRF_K: z.coerce.number().int().positive().default(60),

  // ─── Timeouts (ms) ───────────────────────────────────────────────────────
  QUERY_TRANSFORM_TIMEOUT_MS: z.coerce.number().int().positive().default(2200),
  EMBED_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  EMBED_BATCH_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  VECTOR_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  RERANK_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),

  // ─── Retry / backoff ─────────────────────────────────────────────────────
  RETRY_MAX: z.coerce.number().int().nonnegative().default(3),
  RETRY_BASE_MS: z.coerce.number().int().positive().default(300),

  // ─── Logging ─────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  // ─── HTTP server ─────────────────────────────────────────────────────────
  RAG_API_KEY: z
    .string()
    .min(16, "RAG_API_KEY must be at least 16 characters")
    .default("__unset__"),
  PORT: z.coerce.number().int().positive().default(7000),
  HOST: z.string().default("0.0.0.0"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

function parseConfig() {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`ManimRAG configuration error:\n${errors}`);
  }
  return result.data;
}

export const config = parseConfig();

export type Config = z.infer<typeof ConfigSchema>;

/** Resolve the list of embedder API keys (multi-key rotation). */
export function embedderKeys(): string[] {
  const list = config.EMBEDDER_API_KEYS.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (list.length > 0) return list;
  if (config.EMBEDDER_API_KEY.trim()) return [config.EMBEDDER_API_KEY.trim()];
  return [];
}
