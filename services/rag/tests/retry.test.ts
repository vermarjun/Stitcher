import { describe, it, expect, vi } from "vitest";
import { withRetry, withTimeout, isTransient, TimeoutError } from "../src/util/retry.js";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 50, "x")).resolves.toBe(42);
  });

  it("rejects with TimeoutError when too slow", async () => {
    const slow = new Promise((r) => setTimeout(() => r(1), 100));
    await expect(withTimeout(slow, 10, "slow")).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("withRetry", () => {
  it("returns on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, { retries: 3, baseMs: 1 });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (n++ < 2) throw { status: 503 };
      return "recovered";
    });
    const out = await withRetry(fn, { retries: 5, baseMs: 1 });
    expect(out).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops immediately when shouldRetry returns false", async () => {
    const fn = vi.fn(async () => {
      throw { status: 400 };
    });
    await expect(
      withRetry(fn, { retries: 5, baseMs: 1, shouldRetry: isTransient })
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1); // 400 is not transient
  });

  it("gives up after exhausting retries", async () => {
    const fn = vi.fn(async () => {
      throw new Error("always");
    });
    await expect(withRetry(fn, { retries: 2, baseMs: 1 })).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe("isTransient", () => {
  it("treats 429/5xx/timeouts as transient and 4xx as not", () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
    expect(isTransient(new TimeoutError(1, "x"))).toBe(true);
    expect(isTransient({ status: 400 })).toBe(false);
    expect(isTransient({ status: 404 })).toBe(false);
  });
});
