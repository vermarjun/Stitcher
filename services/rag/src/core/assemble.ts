import { config } from "../config.js";
import { selectPitfalls, selectStyle } from "./knowledge.js";
import type {
  ApiExample,
  ScoredDoc,
  SimilarScript,
  StructuredContext,
  TransformedQuery,
} from "../types.js";

function scoreOf(sd: ScoredDoc): number {
  const s = sd.rerankScore ?? sd.fusedScore ?? sd.similarity ?? 0;
  return Math.round(s * 10000) / 10000;
}

function toApiExample(sd: ScoredDoc): ApiExample {
  return {
    symbol: sd.doc.fullyQualifiedName || sd.doc.title || sd.doc.id,
    category: sd.doc.category,
    signature: sd.doc.signature ?? "",
    docstring: sd.doc.content.slice(0, 1200),
    snippet: sd.doc.code,
    source: sd.doc.source,
    score: scoreOf(sd),
  };
}

function toSimilarScript(sd: ScoredDoc): SimilarScript {
  return {
    id: sd.doc.id,
    title: sd.doc.title,
    description: sd.doc.content,
    apisUsed: sd.doc.apisUsed,
    animationTypes: sd.doc.animationTypes,
    complexity: sd.doc.complexity,
    domain: sd.doc.domain,
    colorPalette: sd.doc.colorPalette,
    code: sd.doc.code,
    source: sd.doc.source,
    score: scoreOf(sd),
  };
}

export interface AssembleOutput {
  structuredContext: StructuredContext;
  groundedPrompt: string;
}

/**
 * Bucket the ranked pool into apiExamples (docType=api) and similarScripts
 * (docType=script), derive style/pitfalls, and assemble the headline
 * groundedPrompt that a downstream code-gen model can consume directly.
 */
export function assemble(
  rawQuery: string,
  transformed: TransformedQuery,
  ranked: ScoredDoc[],
  topK: number
): AssembleOutput {
  const apiDocs = ranked.filter((s) => s.doc.docType === "api");
  const scriptDocs = ranked.filter((s) => s.doc.docType === "script" && s.doc.code.trim());

  const apiExamples = apiDocs.slice(0, topK).map(toApiExample);
  const similarScripts = scriptDocs.slice(0, topK).map(toSimilarScript);

  // Detected APIs = LLM suggestions ∪ APIs referenced by retrieved docs.
  const detectedApis = new Set<string>(transformed.suggestedApis);
  for (const s of ranked.slice(0, topK * 2)) for (const a of s.doc.apisUsed) detectedApis.add(a);

  const domain =
    transformed.domain !== "general"
      ? transformed.domain
      : ranked[0]?.doc.domain ?? "general";

  const observedColors = [...new Set(scriptDocs.flatMap((s) => s.doc.colorPalette))];

  const styleRecommendations = selectStyle([...detectedApis], domain, observedColors);
  const pitfalls = config.STAGE_PITFALLS ? selectPitfalls([...detectedApis], domain) : [];

  const structuredContext: StructuredContext = {
    apiExamples,
    similarScripts,
    styleRecommendations,
    pitfalls,
  };

  const groundedPrompt = buildGroundedPrompt(rawQuery, transformed, structuredContext, [
    ...detectedApis,
  ]);

  return { structuredContext, groundedPrompt };
}

function buildGroundedPrompt(
  rawQuery: string,
  transformed: TransformedQuery,
  ctx: StructuredContext,
  detectedApis: string[]
): string {
  const L: string[] = [];

  L.push(`# Manim Animation Task`);
  L.push("");
  L.push(`TASK: ${rawQuery}`);
  if (transformed.ok && transformed.transformedQuery !== rawQuery) {
    L.push("");
    L.push(`INTERPRETATION: ${transformed.transformedQuery}`);
  }
  L.push("");
  L.push(`Generate a complete, runnable Manim Community v0.19 Python scene for the task above.`);
  L.push("");

  if (detectedApis.length) {
    L.push(`## Likely-relevant Manim APIs`);
    L.push(detectedApis.slice(0, 20).join(", "));
    L.push("");
  }

  if (ctx.apiExamples.length) {
    L.push(`## Relevant API reference (${ctx.apiExamples.length})`);
    for (const a of ctx.apiExamples) {
      L.push(`### ${a.symbol}${a.signature ? ` — ${a.signature}` : ""}`);
      if (a.docstring) L.push(a.docstring.slice(0, 500).trim());
      if (a.snippet?.trim()) {
        L.push("```python");
        L.push(a.snippet.trim());
        L.push("```");
      }
      L.push("");
    }
  }

  if (ctx.similarScripts.length) {
    L.push(`## Similar complete scenes (${ctx.similarScripts.length} — study the patterns)`);
    for (let i = 0; i < ctx.similarScripts.length; i++) {
      const s = ctx.similarScripts[i]!;
      L.push(`### Example ${i + 1}: ${s.title}`);
      if (s.description) L.push(s.description.slice(0, 400).trim());
      if (s.apisUsed.length) L.push(`APIs: ${s.apisUsed.join(", ")}`);
      L.push("```python");
      L.push(s.code.trim());
      L.push("```");
      L.push("");
    }
  }

  if (ctx.styleRecommendations.length) {
    L.push(`## Style guidance`);
    for (const s of ctx.styleRecommendations) L.push(`- ${s}`);
    L.push("");
  }

  if (ctx.pitfalls.length) {
    L.push(`## Pitfalls to avoid`);
    for (const p of ctx.pitfalls) L.push(`- ${p}`);
    L.push("");
  }

  L.push(`## Output requirements`);
  L.push(`- Use \`from manim import *\` and define a single Scene subclass.`);
  L.push(`- Target Manim Community v0.19. Do NOT copy the examples verbatim — adapt their patterns to the task.`);
  L.push(`- Ensure the code is self-contained and runnable with \`manim -pql\`.`);

  return L.join("\n");
}
