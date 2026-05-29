import { describe, it, expect } from "vitest";
import { resolveSettings } from "../src/core/settings.js";
import { config } from "../src/config.js";

describe("resolveSettings", () => {
  it("falls back to env defaults when no overrides given", () => {
    const s = resolveSettings();
    expect(s.stages.rerank).toBe(config.STAGE_RERANK);
    expect(s.llm.model).toBe(config.LLM_MODEL);
    expect(s.reranker.model).toBe(config.RERANKER_MODEL);
    expect(s.llm.apiKey).toBe(config.LLM_API_KEY);
  });

  it("applies request overrides over env defaults", () => {
    const s = resolveSettings({
      stages: { rerank: false, queryTransform: true },
      retrieval: { rerankCandidates: 3 },
      llm: { model: "kimi-k2.5", extraBody: { reasoning_effort: "low" } },
      reranker: { model: "mimo-v2.5" },
    });
    expect(s.stages.rerank).toBe(false);
    expect(s.stages.queryTransform).toBe(true);
    expect(s.retrieval.rerankCandidates).toBe(3);
    expect(s.llm.model).toBe("kimi-k2.5");
    expect(s.llm.extraBody).toEqual({ reasoning_effort: "low" });
    expect(s.reranker.model).toBe("mimo-v2.5");
  });

  it("uses BYO keys when provided, env key otherwise", () => {
    const s = resolveSettings({}, { llmKey: "sk-byo-llm", rerankerKey: "sk-byo-rr" });
    expect(s.llm.apiKey).toBe("sk-byo-llm");
    expect(s.reranker.apiKey).toBe("sk-byo-rr");
    const s2 = resolveSettings({});
    expect(s2.llm.apiKey).toBe(config.LLM_API_KEY);
  });

  it("defaults extraBody to the thinking-disable knob when unset", () => {
    const s = resolveSettings();
    if (config.OPENCODE_DISABLE_THINKING) {
      expect(s.llm.extraBody).toEqual({ thinking: { type: "disabled" } });
    }
  });

  it("rejects a non-http baseUrl", () => {
    expect(() => resolveSettings({ llm: { baseUrl: "ftp://evil/x" } })).toThrow();
  });
});
