/**
 * Rate-limit handling for model calls.
 *
 * LangChain retries every failed call with exponential backoff (up to 6 times)
 * and does not look at the provider's own advice. Free tiers need better:
 *
 *  - A per-minute limit (HTTP 429 with "retry in 8.9s") clears if we wait the
 *    time the provider names. We wait that long, capped at MAX_WAIT_MS.
 *  - A per-day limit never clears within a job. Retrying only burns more of the
 *    quota, so we stop at once and say why.
 *
 * Pass `onFailedAttempt: onRateLimitedAttempt` and `maxRetries: MODEL_MAX_RETRIES`
 * to a LangChain chat model. Throwing from the handler stops the retries.
 */

/** Longest single wait we accept from a provider's retry advice. */
export const MAX_WAIT_MS = 60_000;
/** Retries for transient errors. Enough for a few per-minute 429s. */
export const MODEL_MAX_RETRIES = 4;

/** Prefix of the error thrown when a provider quota is used up. */
export const RATE_LIMIT_PREFIX = "rate_limited";

type ErrLike = { message?: string; status?: number; statusCode?: number; response?: { status?: number } };

export function isRateLimitError(err: unknown): boolean {
  const e = err as ErrLike;
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  if (status === 429) return true;
  const msg = String(e?.message ?? "");
  return /\b429\b/.test(msg) || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg);
}

/** A limit that resets daily (or monthly) cannot be waited out inside a job. */
export function isDailyQuota(err: unknown): boolean {
  const msg = String((err as ErrLike)?.message ?? "");
  return /PerDay|per day|requests per day|daily/i.test(msg);
}

/** Milliseconds the provider asked us to wait, or undefined. */
export function parseRetryDelayMs(err: unknown): number | undefined {
  const msg = String((err as ErrLike)?.message ?? "");
  const m =
    msg.match(/retry in ([\d.]+)\s*s/i) ??
    msg.match(/retryDelay"?\s*[:=]\s*"?([\d.]+)s/i) ??
    msg.match(/retry[- ]after"?\s*[:=]?\s*"?([\d.]+)/i);
  if (!m) return undefined;
  const sec = parseFloat(m[1]!);
  return Number.isFinite(sec) && sec >= 0 ? Math.ceil(sec * 1000) : undefined;
}

export interface RetryDeps {
  sleep: (ms: number) => Promise<void>;
}

const realDeps: RetryDeps = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Build the handler. `deps` is replaceable so tests need not wait. */
export function makeRateLimitHandler(deps: RetryDeps = realDeps) {
  return async (err: unknown): Promise<void> => {
    if (!isRateLimitError(err)) return; // other errors keep LangChain's default backoff
    const raw = String((err as ErrLike)?.message ?? err).replace(/\s+/g, " ").slice(0, 300);
    if (isDailyQuota(err)) {
      throw new Error(`${RATE_LIMIT_PREFIX}: daily quota used up for this model. Wait for the reset, use another model or key, or enable billing. Provider said: ${raw}`);
    }
    const advised = parseRetryDelayMs(err);
    if (advised !== undefined && advised > MAX_WAIT_MS) {
      throw new Error(`${RATE_LIMIT_PREFIX}: provider asked for a ${Math.round(advised / 1000)} s wait, longer than the ${MAX_WAIT_MS / 1000} s limit. Provider said: ${raw}`);
    }
    await deps.sleep(Math.min(advised ?? 0, MAX_WAIT_MS));
  };
}

export const onRateLimitedAttempt = makeRateLimitHandler();

/** Short reason for a failed model call, for job records and logs. */
export function describeModelError(message: string): string {
  if (message.startsWith(RATE_LIMIT_PREFIX)) return message;
  if (isRateLimitError({ message })) return `${RATE_LIMIT_PREFIX}: the provider kept answering 429 after retries. ${message.replace(/\s+/g, " ").slice(0, 200)}`;
  return `model_error: ${message.replace(/\s+/g, " ").slice(0, 300)}`;
}
