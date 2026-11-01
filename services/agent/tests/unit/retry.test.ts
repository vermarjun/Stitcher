process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";
import {
  isDailyQuota,
  isRateLimitError,
  makeRateLimitHandler,
  parseRetryDelayMs,
  describeModelError,
  MAX_WAIT_MS,
  MODEL_MAX_RETRIES,
} from "../../src/models/retry";
import { getModel } from "../../src/models/factory";

const perMinute = new Error(
  "[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded for metric: generate_content_free_tier_requests, limit: 5. " +
    "GenerateRequestsPerMinutePerProjectPerModel-FreeTier. Please retry in 8.952210302s."
);
const perDay = new Error(
  "[429 Too Many Requests] Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit: 20. Please retry in 30s."
);

describe("rate limit detection", () => {
  it("spots 429s and quota errors, not other errors", () => {
    expect(isRateLimitError(perMinute)).toBe(true);
    expect(isRateLimitError({ status: 429, message: "x" })).toBe(true);
    expect(isRateLimitError(new Error("socket hang up"))).toBe(false);
  });
  it("tells daily quotas from per-minute ones", () => {
    expect(isDailyQuota(perDay)).toBe(true);
    expect(isDailyQuota(perMinute)).toBe(false);
  });
  it("reads the provider's retry advice", () => {
    expect(parseRetryDelayMs(perMinute)).toBe(8953);
    expect(parseRetryDelayMs(new Error('details: {"retryDelay":"12s"}'))).toBe(12000);
    expect(parseRetryDelayMs(new Error("boom"))).toBeUndefined();
  });
});

describe("rate limit handler", () => {
  it("waits for the advised time on a per-minute limit", async () => {
    const sleep = jest.fn(async () => {});
    await makeRateLimitHandler({ sleep })(perMinute);
    expect(sleep).toHaveBeenCalledWith(8953);
  });
  it("stops at once on a daily quota, with a reason", async () => {
    const sleep = jest.fn(async () => {});
    await expect(makeRateLimitHandler({ sleep })(perDay)).rejects.toThrow(/^rate_limited: daily quota/);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("refuses to wait longer than the cap", async () => {
    const sleep = jest.fn(async () => {});
    const long = new Error(`[429] Please retry in ${MAX_WAIT_MS / 1000 + 30}s.`);
    await expect(makeRateLimitHandler({ sleep })(long)).rejects.toThrow(/^rate_limited:/);
  });
  it("leaves other errors to LangChain's default backoff", async () => {
    const sleep = jest.fn(async () => {});
    await makeRateLimitHandler({ sleep })(new Error("ECONNRESET"));
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("describeModelError", () => {
  it("labels the cause", () => {
    expect(describeModelError("rate_limited: daily quota used up")).toMatch(/^rate_limited:/);
    expect(describeModelError("[429 Too Many Requests] nope")).toMatch(/^rate_limited:/);
    expect(describeModelError("Invalid API key")).toMatch(/^model_error:/);
  });
});

describe("factory wiring", () => {
  it.each([
    ["gemini", "gemini-2.5-flash"],
    ["openai", "gpt-4.1"],
    ["anthropic", "claude-sonnet-4-6"],
  ])("sets bounded retries and the rate-limit handler on %s", (provider, model) => {
    const m = getModel({ provider, model, apiKey: "k" }) as unknown as {
      caller: { maxRetries: number; onFailedAttempt: unknown };
    };
    expect(m.caller.maxRetries).toBe(MODEL_MAX_RETRIES);
    expect(typeof m.caller.onFailedAttempt).toBe("function");
    expect(m.caller.onFailedAttempt).not.toBeUndefined();
  });
});
