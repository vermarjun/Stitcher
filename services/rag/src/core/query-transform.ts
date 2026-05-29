import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chatStructured } from "../providers/llm.js";
import { log } from "../logger.js";
import { withTimeout } from "../util/retry.js";
import type { Complexity, TransformedQuery } from "../types.js";
import type { ResolvedSettings } from "./settings.js";

let _systemPrompt: string | null = null;
function systemPrompt(): string {
  if (_systemPrompt === null) {
    try {
      const p = fileURLToPath(new URL("../../prompts/query-transformer.txt", import.meta.url));
      _systemPrompt = readFileSync(p, "utf-8");
    } catch {
      _systemPrompt =
        "You are a Manim expert. Rewrite the user's animation request into a precise, " +
        "Manim-API-specific description and list the likely Manim classes/animations.";
    }
  }
  return _systemPrompt;
}

const SCHEMA = {
  type: "object",
  properties: {
    transformedQuery: {
      type: "string",
      description: "Technical, Manim-API-specific description of the animation.",
    },
    suggestedApis: {
      type: "array",
      items: { type: "string" },
      description: "Manim classes / animations likely needed (e.g. VGroup, Rectangle, FadeIn).",
    },
    domain: {
      type: "string",
      enum: ["cs", "math", "physics", "biology", "chemistry", "general"],
    },
    tags: { type: "array", items: { type: "string" } },
    estimatedComplexity: { type: "string", enum: ["beginner", "intermediate", "expert"] },
  },
  required: ["transformedQuery", "suggestedApis", "domain", "tags", "estimatedComplexity"],
} as const;

function rawFallback(rawQuery: string): TransformedQuery {
  return {
    transformedQuery: rawQuery,
    suggestedApis: [],
    domain: "general",
    tags: [],
    estimatedComplexity: "intermediate",
    ok: false,
  };
}

/**
 * Transform the raw query into a richer, API-specific form. Opt-in via
 * STAGE_QUERY_TRANSFORM; bounded by QUERY_TRANSFORM_TIMEOUT_MS; never throws —
 * any failure (disabled / timeout / bad model) degrades to embedding the raw query.
 */
export async function transformQuery(
  rawQuery: string,
  settings: ResolvedSettings
): Promise<TransformedQuery> {
  if (!settings.stages.queryTransform) return rawFallback(rawQuery);

  try {
    const result = await withTimeout(
      chatStructured<Omit<TransformedQuery, "ok">>({
        target: settings.llm,
        messages: [
          { role: "system", content: systemPrompt() },
          {
            role: "user",
            content: `Transform this Manim animation request into a technical, API-specific description:\n\n"${rawQuery}"`,
          },
        ],
        schema: SCHEMA as unknown as Record<string, unknown>,
        timeoutMs: settings.timeouts.queryTransformMs,
      }),
      settings.timeouts.queryTransformMs,
      "query-transform"
    );

    return {
      transformedQuery: result.transformedQuery || rawQuery,
      suggestedApis: Array.isArray(result.suggestedApis) ? result.suggestedApis : [],
      domain: result.domain || "general",
      tags: Array.isArray(result.tags) ? result.tags : [],
      estimatedComplexity: (result.estimatedComplexity as Complexity) || "intermediate",
      ok: true,
    };
  } catch (err) {
    log.warn(
      { err: String(err), query: rawQuery.slice(0, 80) },
      "Query transform failed — falling back to raw query"
    );
    return rawFallback(rawQuery);
  }
}

/** Text to embed: enrich with suggested APIs when the transform succeeded. */
export function embeddingTextFor(rawQuery: string, t: TransformedQuery): string {
  if (!t.ok) return rawQuery;
  const apis = t.suggestedApis.length ? `\nRelevant Manim APIs: ${t.suggestedApis.join(", ")}` : "";
  return `${t.transformedQuery}${apis}`;
}
