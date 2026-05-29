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
    log.warn(
      { expected: config.EMBEDDING_DIM, actual: dims, model: config.EMBEDDER_MODEL, where },
      "Embedding dimension mismatch — EMBEDDING_DIM must match the index numDimensions"
    );
  }
}

// ─── Ollama ────────────────────────────────────────────────────────────────

async function ollamaEmbed(texts: string[], timeoutMs: number): Promise<number[][]> {
  const data = await withRetry(
    () =>
      postJson(
        `${config.OLLAMA_BASE_URL}/api/embed`,
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
        `${config.GEMINI_BASE_URL}/models/${model}:embedContent?key=${key}`,
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
        `${config.GEMINI_BASE_URL}/models/${model}:batchEmbedContents?key=${key}`,
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

// ─── Public API ──────────────────────────────────────────────────────────────

/** Embed a single text (query-time). */
export async function embedQuery(
  text: string,
  taskType: EmbedTaskType = "RETRIEVAL_QUERY"
): Promise<number[]> {
  if (PROVIDER === "ollama") return (await ollamaEmbed([text], config.EMBED_TIMEOUT_MS))[0]!;
  if (PROVIDER === "gemini") return geminiEmbedSingle(text, taskType);
  throw new Error(`Unsupported EMBEDDER_PROVIDER: ${config.EMBEDDER_PROVIDER}`);
}

/** Embed many texts (seed-time, document side). */
export async function embedBatch(
  texts: string[],
  taskType: EmbedTaskType = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (PROVIDER === "ollama") return ollamaEmbed(texts, config.EMBED_BATCH_TIMEOUT_MS);
  if (PROVIDER === "gemini") return geminiEmbedBatch(texts, taskType);
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
