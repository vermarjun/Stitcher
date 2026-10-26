import { describe, it, expect } from "vitest";
import { rrfMerge } from "../src/core/retrieve.js";
import { assemble } from "../src/core/assemble.js";
import type { CorpusDoc, ScoredDoc, TransformedQuery } from "../src/types.js";

function doc(id: string, docType: "api" | "script", code = ""): CorpusDoc {
  return {
    id,
    docType,
    embedText: id,
    title: id,
    content: `content of ${id}`,
    code,
    apisUsed: ["VGroup", "FadeIn"],
    animationTypes: ["FadeIn"],
    category: "scenes",
    domain: "cs",
    tags: [],
    complexity: "intermediate",
    quality: 4,
    colorPalette: ["#1a1a2e"],
    manimVersion: "0.19.0",
    source: "test",
    createdAt: "now",
  };
}
const sd = (id: string, dt: "api" | "script", sim: number, code = ""): ScoredDoc => ({
  doc: doc(id, dt, code),
  similarity: sim,
});

describe("rrfMerge", () => {
  it("fuses two ranked lists and ranks shared docs higher", () => {
    const dense = [sd("a", "api", 0.9), sd("b", "api", 0.8), sd("c", "api", 0.7)];
    const sparse = [sd("b", "api", 0), sd("a", "api", 0), sd("d", "api", 0)];
    const merged = rrfMerge(dense, sparse, 60);
    // a and b appear in both lists → should outrank c and d
    expect(merged[0]!.doc.id === "a" || merged[0]!.doc.id === "b").toBe(true);
    const ids = merged.map((m) => m.doc.id);
    expect(ids).toContain("d");
    expect(merged.every((m) => typeof m.fusedScore === "number")).toBe(true);
  });
});

describe("assemble", () => {
  const transformed: TransformedQuery = {
    transformedQuery: "bubble sort bars",
    suggestedApis: ["Rectangle", "Transform"],
    domain: "cs",
    tags: ["sort"],
    estimatedComplexity: "intermediate",
    ok: true,
  };

  it("buckets api docs and script docs separately", () => {
    const ranked: ScoredDoc[] = [
      { ...sd("api1", "api", 0.9), rerankScore: 0.95 },
      { ...sd("script1", "script", 0.8, "from manim import *\nclass S(Scene):\n  def construct(self):\n    pass"), rerankScore: 0.9 },
      { ...sd("api2", "api", 0.7), rerankScore: 0.6 },
    ];
    const { structuredContext, groundedPrompt } = assemble("animate bubble sort", transformed, ranked, 5);
    expect(structuredContext.apiExamples.length).toBe(2);
    expect(structuredContext.similarScripts.length).toBe(1);
    expect(structuredContext.similarScripts[0]!.code).toContain("class S(Scene)");
    expect(structuredContext.pitfalls.length).toBeGreaterThan(0);
    expect(structuredContext.styleRecommendations.length).toBeGreaterThan(0);
    // groundedPrompt is the headline output and must include the task + a code block
    expect(groundedPrompt).toContain("animate bubble sort");
    expect(groundedPrompt).toContain("```python");
  });

  it("drops script docs that have no code from similarScripts", () => {
    const ranked: ScoredDoc[] = [sd("s_empty", "script", 0.8, "")];
    const { structuredContext } = assemble("x", transformed, ranked, 5);
    expect(structuredContext.similarScripts.length).toBe(0);
  });
});
