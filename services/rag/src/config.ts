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
  MONGODB_URL: z.string().default("mongodb://localhost:27017/?directConnection=true"),
  MONGODB_DB_NAME: z.string().default("manimrag"),
  VECTOR_STORE: z.enum(["mongodb_atlas"]).default("mongodb_atlas"),
  COLLECTION_NAME: z.string().default("manimrag_corpus"),
  VECTOR_INDEX_NAME: z.string().default("manimrag_vector_index"),
  TEXT_INDEX_NAME: z.string().default("manimrag_text_index"),

  // ─── Embedder ───────────────────────────────────────────────────
  EMBEDDER_PROVIDER: z.enum(["local", "gemini", "openai", "ollama"]).default("local"),
  // "local" runs a small ONNX model on CPU inside this process (no key, no network
  // once the weights are cached). MODELS_DIR is where the weights live.
  MODELS_DIR: z.string().default(".models"),
  EMBEDDER_OFFLINE: boolEnv(false),
  LOCAL_EMBED_DTYPE: z.enum(["fp32", "fp16", "q8", "q4"]).default("q8"),
  // Single key (back-compat) OR a comma-separated list rotated across requests.
  EMBEDDER_API_KEY: z.string().default(""),
  EMBEDDER_API_KEYS: z.string().default(""),
  EMBEDDER_MODEL: z.string().optional(),
  EMBEDDING_DIM: z.coerce.number().int().positive().max(4096).optional(),
  EMBED_BATCH_SIZE: z.coerce.number().int().positive().max(250).default(100),
  GEMINI_BASE_URL: z
    .string()
    .default("https://generativelanguage.googleapis.com/v1beta"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),

  // ─── Query-transform LLM ────────
  LLM_PROVIDER: z.string().default("openai"),
  LLM_API_KEY: z.string().default(""),
  LLM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  RERANKER_BASE_URL: z.string().optional(),
  EMBEDDER_BASE_URL: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENCODE_GO_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1"),
  // OpenCode-Go models default to "thinking" mode (slow). Sending
  // thinking:{type:"disabled"} turns it off (~5x faster) — verified to keep
  // tool_choice working on glm-5.1 and clean JSON on deepseek-v4-flash.
  OPENCODE_DISABLE_THINKING: boolEnv(true),
  // Optional SSRF guard for per-request llm/reranker baseUrl overrides:
  // comma-separated allowed prefixes. Empty = allow any (dev convenience).
  ALLOWED_LLM_BASE_URLS: z.string().default(""),

  // ─── Reranker (plain completion, high-quota model) ───────────────────────
  RERANKER_PROVIDER: z.string().optional(),
  RERANKER_API_KEY: z.string().default(""),
  RERANKER_MODEL: z.string().optional(),
  RERANKER_TOP_N: z.coerce.number().int().positive().default(5),

  // ─── Pipeline stage toggles (opt-in at runtime) ──────────────────────────
  STAGE_QUERY_TRANSFORM: boolEnv(false),
  STAGE_SPARSE: boolEnv(false),
  STAGE_RERANK: boolEnv(false),
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
    .refine((v) => v === "__unset__" || v.length >= 16, "RAG_API_KEY must be at least 16 characters")
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
  const c = result.data;
  const llm = providerDefaults(c.LLM_PROVIDER);
  const rerankerProvider = c.RERANKER_PROVIDER ?? c.LLM_PROVIDER;
  const reranker = providerDefaults(rerankerProvider);
  const embedModel = c.EMBEDDER_MODEL ?? ({ local: "Xenova/bge-small-en-v1.5", gemini: "gemini-embedding-001", openai: "text-embedding-3-small", ollama: "nomic-embed-text" }[c.EMBEDDER_PROVIDER]);
  if (!embedModel) throw new Error(`Unsupported EMBEDDER_PROVIDER: ${c.EMBEDDER_PROVIDER}`);
  const dimensions: Record<string, number> = { "gemini-embedding-001": 3072, "text-embedding-3-small": 1536, "text-embedding-3-large": 3072, "text-embedding-ada-002": 1536, "nomic-embed-text": 768, "Xenova/bge-small-en-v1.5": 384, "Xenova/all-MiniLM-L6-v2": 384, "Xenova/bge-base-en-v1.5": 768, "bge-m3": 1024, "all-minilm": 384 };
  const dim = c.EMBEDDING_DIM ?? dimensions[embedModel];
  if (!dim) throw new Error("Set EMBEDDING_DIM for an unknown embedding model");
  const llmBase = c.LLM_BASE_URL ?? (llm.provider === "opencodego" ? c.OPENCODE_GO_BASE_URL : llm.baseUrl);
  return {
    ...c,
    LLM_MODEL: c.LLM_MODEL ?? llm.model,
    LLM_BASE_URL: llmBase,
    RERANKER_PROVIDER: rerankerProvider,
    RERANKER_MODEL: c.RERANKER_MODEL
      ?? (rerankerProvider === c.LLM_PROVIDER ? c.LLM_MODEL : undefined)
      ?? reranker.model,
    RERANKER_BASE_URL: c.RERANKER_BASE_URL
      ?? (rerankerProvider === c.LLM_PROVIDER ? llmBase : undefined)
      ?? (reranker.provider === "opencodego" ? c.OPENCODE_GO_BASE_URL : reranker.baseUrl),
    EMBEDDER_MODEL: embedModel,
    EMBEDDING_DIM: dim,
  };

}

export function providerDefaults(provider: string) {
  const name = provider === "opencode" ? "opencodego" : provider;
  const defaults: Record<string, { baseUrl: string; model: string }> = {
    openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
    openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
    ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
    opencodego: { baseUrl: "https://opencode.ai/zen/go/v1", model: "glm-5.1" },
  };
  const result = defaults[name];
  if (!result) throw new Error(`Unsupported LLM provider: ${provider}`);
  return { ...result, provider: name };
}

export const config = parseConfig();

export type Config = ReturnType<typeof parseConfig>;

/** Resolve the list of embedder API keys (multi-key rotation). */
export function embedderKeys(): string[] {
  const list = config.EMBEDDER_API_KEYS.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (list.length > 0) return list;
  if (config.EMBEDDER_API_KEY.trim()) return [config.EMBEDDER_API_KEY.trim()];
  if (config.LLM_API_KEY.trim()) return [config.LLM_API_KEY.trim()];
  return [];
}
