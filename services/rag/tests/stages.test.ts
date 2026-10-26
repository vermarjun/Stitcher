import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSettings } from "../src/core/settings.js";
import { transformQuery } from "../src/core/query-transform.js";
import { rerank } from "../src/core/rerank.js";
import type { ScoredDoc } from "../src/types.js";

afterEach(() => vi.unstubAllGlobals());
const docs = [0, 1].map((n) => ({ doc: { id: String(n), title: "Scene", content: "example", apisUsed: [] }, similarity: 0.8 - n / 10 })) as ScoredDoc[];
describe("optional stages", () => {
  it("does not contact chat providers when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = resolveSettings({ stages: { queryTransform: false, rerank: false } });
    expect((await transformQuery("bubble sort", s)).transformedQuery).toBe("bubble sort");
    expect(await rerank("bubble sort", docs, s)).toEqual({ ranked: docs, ran: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps the query and retrieval order on provider rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid key", { status: 401 })));
    const s = resolveSettings({ stages: { queryTransform: true, rerank: true } });
    expect((await transformQuery("bubble sort", s)).ok).toBe(false);
    expect(await rerank("bubble sort", docs, s)).toEqual({ ranked: docs, ran: false });
  });
  it("uses an explicitly selected query-transform provider's endpoint", async () => {
    const mock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"transformedQuery":"Sort bars"}' } }] })));
    vi.stubGlobal("fetch", mock);
    const s = resolveSettings({ stages: { queryTransform: true } });
    expect((await transformQuery("sort", s, { provider: "gemini", apiKey: "test-key" })).ok).toBe(true);
    expect(mock.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  });
});
