/**
 * Embedder — provider-dispatched, lean fetch-based clients. Selected by
 * EMBEDDER_PROVIDER; nothing is hardcoded.
 *
 *   - "ollama"  → local Ollama /api/embed (e.g. bge-m3, 1024-dim). No rate
 *                 limit, no API key. taskType is ignored (BGE is prefix-free).
 *   - "gemini"  → Gemini gemini-embedding-001 (3072-dim default; MRL truncation
 *                 via EMBEDDING_DIM). Round-robin keys + 429-aware backoff that
 *                 honors the server's per-minute retry window.
 *
 * All vectors are L2-normalized for cosine correctness.
 * EMBEDDING_DIM MUST equal the vector index's numDimensions.
 */

import { config, embedderKeys } from "../config.js";
import { log } from "../logger.js";
import { withRetry, isTransient } from "../util/retry.js";
import type { EmbedderProviderOverride } from "../types.js";

export type EmbedTaskType =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "QUESTION_ANSWERING";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const PROVIDER = config.EMBEDDER_PROVIDER.toLowerCase();
const KEYS = embedderKeys();
let keyCursor = 0;
function nextKey(): string {
  if (KEYS.length === 0) {
    throw new Error("No embedder API key configured (set EMBEDDER_API_KEY or EMBEDDER_API_KEYS)");
  }
  const k = KEYS[keyCursor % KEYS.length]!;
  keyCursor++;
  return k;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse Gemini's server-supplied retry delay (per-minute quota window). */
function parseRetryDelayMs(message: string): number {
  const m1 = message.match(/retry in ([\d.]+)s/i);
  if (m1) return Math.ceil(parseFloat(m1[1]!) * 1000) + 1500;
  const m2 = message.match(/"retryDelay":\s*"(\d+)s"/);
  if (m2) return parseInt(m2[1]!, 10) * 1000 + 1500;
  return 60_000;
}

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0 || !Number.isFinite(norm)) return v;
  return v.map((x) => x / norm);
}

async function postJson(url: string, body: unknown, timeoutMs: number, headers: Record<string, string> = {}): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, `${PROVIDER} ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function checkDim(dims: number, where: string): void {
  if (dims !== config.EMBEDDING_DIM) {
    throw new Error(`Embedding dimension mismatch: expected ${config.EMBEDDING_DIM}, got ${dims} (${where}). Re-seed with a matching model and index.`);
  }
}

// ─── Ollama ────────────────────────────────────────────────────────────────

async function ollamaEmbed(texts: string[], timeoutMs: number): Promise<number[][]> {
  const data = await withRetry(
    () =>
      postJson(
        `${config.EMBEDDER_BASE_URL ?? config.OLLAMA_BASE_URL}/api/embed`,
        { model: config.EMBEDDER_MODEL, input: texts },
        timeoutMs
      ),
    {
      retries: config.RETRY_MAX,
      baseMs: config.RETRY_BASE_MS,
      label: "ollama.embed",
      shouldRetry: isTransient,
      onRetry: (err, attempt, delay) =>
        log.warn({ attempt, delay, n: texts.length, err: String(err) }, "Retrying Ollama embedding"),
    }
  );
  const embeddings: number[][] | undefined = data?.embeddings;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error(`Ollama returned ${embeddings?.length ?? 0} embeddings for ${texts.length} inputs`);
  }
  if (embeddings[0]) checkDim(embeddings[0].length, "ollama");
  return embeddings.map(l2normalize);
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function geminiEmbedSingle(text: string, taskType: EmbedTaskType): Promise<number[]> {
  const model = config.EMBEDDER_MODEL;
  const vec = await withRetry(
    async () => {
      const key = nextKey();
      const data = await postJson(
        `${config.EMBEDDER_BASE_URL ?? config.GEMINI_BASE_URL}/models/${model}:embedContent?key=${key}`,
        { model: `models/${model}`, content: { parts: [{ text }] }, taskType, outputDimensionality: config.EMBEDDING_DIM },
        config.EMBED_TIMEOUT_MS
      );
      const values: number[] | undefined = data?.embedding?.values;
      if (!values?.length) throw new Error("Gemini returned empty embedding");
      return values;
    },
    { retries: config.RETRY_MAX, baseMs: config.RETRY_BASE_MS, label: "gemini.embedQuery", shouldRetry: isTransient }
  );
  checkDim(vec.length, "gemini");
  return l2normalize(vec);
}

async function geminiEmbedBatch(texts: string[], taskType: EmbedTaskType): Promise<number[][]> {
  const model = config.EMBEDDER_MODEL;
  const maxAttempts = Math.max(KEYS.length * 4, 10);
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const key = nextKey();
      const data = await postJson(
        `${config.EMBEDDER_BASE_URL ?? config.GEMINI_BASE_URL}/models/${model}:batchEmbedContents?key=${key}`,
        {
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: config.EMBEDDING_DIM,
          })),
        },
        config.EMBED_BATCH_TIMEOUT_MS
      );
      const embeddings: Array<{ values: number[] }> | undefined = data?.embeddings;
      if (!embeddings || embeddings.length !== texts.length) {
        throw new Error(`Gemini batch returned ${embeddings?.length ?? 0} for ${texts.length} inputs`);
      }
      if (embeddings[0]) checkDim(embeddings[0].values.length, "gemini");
      return embeddings.map((e) => l2normalize(e.values));
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = err instanceof HttpError && err.status === 429;
      const delay = is429
        ? parseRetryDelayMs(msg)
        : Math.min(config.RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500, 15000);
      log.warn(
        { attempt: attempt + 1, delayMs: delay, batch: texts.length, quota: is429 },
        is429 ? "Embedding quota hit — waiting out the per-minute window" : "Retrying batch embedding"
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function openaiEmbed(texts: string[], timeoutMs: number): Promise<number[][]> {
  const data = await withRetry(() => postJson(
    `${(config.EMBEDDER_BASE_URL ?? config.OPENAI_BASE_URL).replace(/\/$/, "")}/embeddings`,
    { model: config.EMBEDDER_MODEL, input: texts, ...(config.EMBEDDER_MODEL.startsWith("text-embedding-3-") ? { dimensions: config.EMBEDDING_DIM } : {}) },
    timeoutMs, { Authorization: `Bearer ${nextKey()}` }
  ), { retries: config.RETRY_MAX, baseMs: config.RETRY_BASE_MS, label: "openai.embed", shouldRetry: isTransient });
  const rows = data?.data?.sort((a: any, b: any) => a.index - b.index);
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new Error("OpenAI returned an incorrect embedding count");
  return rows.map((r: any) => {
    if (!Array.isArray(r.embedding)) throw new Error("OpenAI returned an empty embedding");
    checkDim(r.embedding.length, "openai");
    return l2normalize(r.embedding);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Embed a single text (query-time). */
export async function embedQuery(
  text: string,
  taskType: EmbedTaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  if (PROVIDER === "ollama") return (await ollamaEmbed([text], config.EMBED_TIMEOUT_MS))[0]!;
  if (PROVIDER === "gemini") return geminiEmbedSingle(text, taskType);
  if (PROVIDER === "openai") return (await openaiEmbed([text], config.EMBED_TIMEOUT_MS))[0]!;
  throw new Error(`Unsupported EMBEDDER_PROVIDER: ${config.EMBEDDER_PROVIDER}`);
}

// ─── Single-attempt embed helpers (one key / one endpoint, raw un-normalized vector) ───

/** One Gemini embedContent call with a SPECIFIC key (own retry/backoff). Throws on failure. */
async function geminiEmbedOnce(
  text: string,
  taskType: EmbedTaskType,
  model: string,
  baseURL: string,
  apiKey: string
): Promise<number[]> {
  return withRetry(
    async () => {
      const resp = await postJson(
        `${baseURL}/models/${model}:embedContent?key=${apiKey}`,
        { model: `models/${model}`, content: { parts: [{ text }] }, taskType, outputDimensionality: config.EMBEDDING_DIM },
        config.EMBED_TIMEOUT_MS
      );
      const values: number[] | undefined = resp?.embedding?.values;
      if (!values?.length) throw new Error("Gemini returned empty embedding");
      return values;
    },
    { retries: config.RETRY_MAX, baseMs: config.RETRY_BASE_MS, label: "gemini.embed.override", shouldRetry: isTransient }
  );
}

/** One Ollama /api/embed call with overridden base/model. Throws on failure. */
async function ollamaEmbedOnce(text: string, model: string, baseURL: string): Promise<number[]> {
  const data = await withRetry(
    () => postJson(`${baseURL}/api/embed`, { model, input: [text] }, config.EMBED_TIMEOUT_MS),
    {
      retries: config.RETRY_MAX,
      baseMs: config.RETRY_BASE_MS,
      label: "ollama.embed.override",
      shouldRetry: isTransient,
      onRetry: (err, attempt, delay) =>
        log.warn({ attempt, delay, err: String(err) }, "Retrying Ollama embedding (override)"),
    }
  );
  const embeddings: number[][] | undefined = data?.embeddings;
  if (!embeddings || embeddings.length !== 1) {
    throw new Error(`Ollama override returned ${embeddings?.length ?? 0} embeddings for 1 input`);
  }
  return embeddings[0]!;
}

/** One OpenAI-compatible /embeddings call. Throws on failure. */
async function openaiEmbedOnce(text: string, model: string, baseURL: string, apiKey: string): Promise<number[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.EMBED_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, input: text, ...(model.startsWith("text-embedding-3-") ? { dimensions: config.EMBEDDING_DIM } : {}) }),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`embedder override (openai) ${res.status}: ${txt.slice(0, 300)}`);
    const raw = JSON.parse(txt);
    const values: number[] | undefined = raw?.data?.[0]?.embedding;
    if (!values?.length) throw new Error("embedder override (openai) returned empty embedding");
    return values;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Embed a single text using a per-request provider override (CONTRACT 2), with a
 * resilient FAILOVER CHAIN so RAG never goes dark on a single bad/rate-limited key:
 *
 *   primary admin key → admin backup key(s) → ENV-default embedder (EMBEDDER_API_KEY)
 *
 * Each attempt is tried in order; on ANY failure (network, 401/403 invalid key,
 * 429 rate-limit, empty/wrong-dim vector) we log and advance to the next. The
 * ENV-default attempt is ALWAYS appended last — the admin can configure Gemini
 * keys in the panel, but if they're all rate-limited (gemini-embedding-001 is
 * free-tier) or wrong, the .env key still serves the request. Only when EVERY
 * attempt fails do we throw (→ the pipeline falls back to the raw prompt).
 *
 * A returned vector whose dim != EMBEDDING_DIM is treated as a failure so a
 * mismatched provider (e.g. a 1024-dim model against a 3072-dim index) falls
 * through to the dimension-correct env default rather than poisoning retrieval.
 */
export async function embedQueryWithOverride(
  text: string,
  override?: EmbedderProviderOverride,
  taskType: EmbedTaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  // No override at all: use the env-default path directly.
  const hasOverride =
    !!override &&
    (!!override.provider || !!override.apiKey || !!override.baseURL || !!override.model ||
      (Array.isArray(override.backupApiKeys) && override.backupApiKeys.length > 0));
  if (!hasOverride) return embedQuery(text, taskType);

  const provider = (override!.provider ?? config.EMBEDDER_PROVIDER).toLowerCase();
  const model = override!.model ?? config.EMBEDDER_MODEL;
  const baseURL = override!.baseURL;

  // Build the ordered attempt chain.
  const attempts: Array<{ label: string; run: () => Promise<number[]> }> = [];

  if (provider === "gemini") {
    const geminiBase = baseURL ?? config.GEMINI_BASE_URL;
    const keys = [override!.apiKey, ...(override!.backupApiKeys ?? [])]
      .map((k) => (k ?? "").trim())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) continue;
      seen.add(k);
      const label = seen.size === 1 ? "gemini.override.primary" : `gemini.override.backup#${seen.size - 1}`;
      attempts.push({ label, run: () => geminiEmbedOnce(text, taskType, model, geminiBase, k) });
    }
  } else if (provider === "ollama") {
    const ollamaBase = baseURL ?? config.OLLAMA_BASE_URL;
    attempts.push({ label: "ollama.override", run: () => ollamaEmbedOnce(text, model, ollamaBase) });
  } else if (provider === "openai" || baseURL) {
    attempts.push({ label: `${provider}.override`, run: () => openaiEmbedOnce(text, model, baseURL ?? config.OPENAI_BASE_URL, override!.apiKey ?? nextKey()) });
  }

  // FINAL fallback — the env-default embedder (EMBEDDER_API_KEY/-KEYS). This is the
  // ".env key" backstop: even if every admin key fails, RAG still gets a vector.
  attempts.push({ label: "env-default", run: () => embedQuery(text, taskType) });

  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;
    try {
      const vec = await a.run();
      if (vec.length !== config.EMBEDDING_DIM) {
        throw new Error(`embedding dim ${vec.length} != EMBEDDING_DIM ${config.EMBEDDING_DIM}`);
      }
      if (i > 0) {
        log.warn({ usedAttempt: a.label, attemptIndex: i, total: attempts.length }, "embedder failed over to a later key/provider");
      }
      return l2normalize(vec);
    } catch (err) {
      lastErr = err;
      log.warn(
        { attempt: a.label, hasNext: i < attempts.length - 1, err: String(err) },
        "embedder attempt failed; advancing to next key/provider"
      );
    }
  }
  throw lastErr;
}

/** Embed many texts (seed-time, document side). */
export async function embedBatch(
  texts: string[],
  taskType: EmbedTaskType = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (PROVIDER === "ollama") return ollamaEmbed(texts, config.EMBED_BATCH_TIMEOUT_MS);
  if (PROVIDER === "gemini") return geminiEmbedBatch(texts, taskType);
  if (PROVIDER === "openai") return openaiEmbed(texts, config.EMBED_BATCH_TIMEOUT_MS);
  throw new Error(`Unsupported EMBEDDER_PROVIDER: ${config.EMBEDDER_PROVIDER}`);
}

export function embedderInfo() {
  return {
    provider: config.EMBEDDER_PROVIDER,
    model: config.EMBEDDER_MODEL,
    dim: config.EMBEDDING_DIM,
    keys: PROVIDER === "ollama" ? 0 : KEYS.length,
  };
}
