/**
 * Resilience primitives — per-call timeouts and exponential backoff with jitter.
 *
 * Every external call (embedder, LLM, reranker, Mongo) flows through these so a
 * slow or flaky dependency degrades gracefully instead of hanging the request.
 */

export class TimeoutError extends Error {
  constructor(ms: number, label: string) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Reject if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export interface RetryOptions {
  retries: number; // number of *additional* attempts after the first
  baseMs: number; // base backoff
  factor?: number; // backoff multiplier (default 2)
  maxDelayMs?: number; // cap (default 8000)
  timeoutMs?: number; // optional per-attempt timeout
  label?: string;
  /** Return false to stop retrying immediately (e.g. 4xx that won't recover). */
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`, retrying with exponential backoff + jitter on failure. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const factor = opts.factor ?? 2;
  const maxDelay = opts.maxDelayMs ?? 8000;
  const label = opts.label ?? "operation";
  let lastErr: unknown;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const call = opts.timeoutMs ? withTimeout(fn(), opts.timeoutMs, label) : fn();
      return await call;
    } catch (err) {
      lastErr = err;
      const more = attempt < opts.retries;
      const retryable = opts.shouldRetry ? opts.shouldRetry(err) : true;
      if (!more || !retryable) break;

      const exp = opts.baseMs * Math.pow(factor, attempt);
      const jitter = Math.floor(Math.random() * opts.baseMs);
      const delay = Math.min(exp + jitter, maxDelay);
      opts.onRetry?.(err, attempt + 1, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** True for transient HTTP/network errors worth retrying. */
export function isTransient(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    return status === 408 || status === 429 || status >= 500;
  }
  const code = (err as { code?: string })?.code;
  if (typeof code === "string") {
    return ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(
      code
    );
  }
  return true; // unknown errors: assume transient (bounded by retries)
}
