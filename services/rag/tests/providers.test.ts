import { afterEach, describe, expect, it, vi } from "vitest";
import { providerDefaults } from "../src/config.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("provider configuration", () => {
  it.each([
    ["openai", "https://api.openai.com/v1", "gpt-4o-mini"],
    ["gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash"],
    ["openrouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini"],
    ["ollama", "http://localhost:11434/v1", "llama3.2"],
    ["opencodego", "https://opencode.ai/zen/go/v1", "glm-5.1"],
  ])("resolves %s defaults", (provider, baseUrl, model) => {
    expect(providerDefaults(provider)).toMatchObject({ baseUrl, model });
  });
  it("rejects unknown providers", () => expect(() => providerDefaults("typo")).toThrow("Unsupported"));
  it.each(["openai", "gemini", "openrouter", "ollama", "opencodego"])("sends the correct %s endpoint and body", async (provider) => {
    vi.stubEnv("LLM_PROVIDER", provider);
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_BASE_URL", "http://localhost:1234/v1");
    const { resolveSettings } = await import("../src/core/settings.js");
    const { chatText } = await import("../src/providers/llm.js");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const s = resolveSettings();
    expect(s.reranker.apiKey).toBe("test-key");
    expect(s.reranker.baseUrl).toBe("http://localhost:1234/v1");
    await chatText({ target: s.llm, messages: [{ role: "user", content: "ping" }], timeoutMs: 100 });
    const [url, req] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:1234/v1/chat/completions");
    expect(JSON.parse(req.body).thinking).toEqual(provider === "opencodego" ? { type: "disabled" } : undefined);
  });
  it("embeds OpenAI batches in input order and requests matching dimensions", async () => {
    vi.stubEnv("EMBEDDER_PROVIDER", "openai");
    vi.stubEnv("EMBEDDER_API_KEY", "test-key");
    vi.stubEnv("EMBEDDING_DIM", "2");
    const { embedBatch } = await import("../src/providers/embedder.js");
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 1, embedding: [0, 2] }, { index: 0, embedding: [2, 0] }] })));
    vi.stubGlobal("fetch", mock);
    expect(await embedBatch(["a", "b"])).toEqual([[1, 0], [0, 1]]);
    expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({ model: "text-embedding-3-small", dimensions: 2 });
  });
  it("rejects embedding vectors that cannot match the index", async () => {
    vi.stubEnv("EMBEDDER_PROVIDER", "openai");
    vi.stubEnv("EMBEDDER_API_KEY", "test-key");
    vi.stubEnv("EMBEDDING_DIM", "2");
    const { embedBatch } = await import("../src/providers/embedder.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: [1] }] }))));
    await expect(embedBatch(["a"])).rejects.toThrow("dimension mismatch");
  });
});
