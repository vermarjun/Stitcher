import { transformQuery, embeddingTextFor } from "./query-transform.js";
import { embedQuery } from "../providers/embedder.js";
import { retrieve } from "./retrieve.js";
import { rerank } from "./rerank.js";
import { assemble } from "./assemble.js";
import { resolveSettings, type ResolvedSettings } from "./settings.js";
import { config } from "../config.js";
import { log } from "../logger.js";
import type { EnhanceInput, EnhanceResult } from "../types.js";

/**
 * End-to-end enhance pipeline:
 *   query transform → embed → dense (+ optional sparse/RRF) → rerank → assemble.
 * Every stage is timed and resilient; the query-transform and rerank stages
 * degrade gracefully so a single LLM hiccup never fails the request.
 */
export async function enhance(
  input: EnhanceInput,
  settings: ResolvedSettings = resolveSettings()
): Promise<EnhanceResult> {
  const t0 = Date.now();
  const topK = input.topK ?? settings.defaultTopK;
  let llmCalls = 0;

  // ── 1. Query transform (optional, timeout + raw fallback) ─────────────────
  const tQ = Date.now();
  const transformed = await transformQuery(input.prompt, settings);
  const queryTransformMs = Date.now() - tQ;
  if (transformed.ok) llmCalls++;

  // ── 2. Embed ──────────────────────────────────────────────────────────────
  const tE = Date.now();
  const queryVector = await embedQuery(embeddingTextFor(input.prompt, transformed));
  const embeddingMs = Date.now() - tE;

  // ── 3. Retrieve (dense + optional sparse → RRF) ───────────────────────────
  const sparseQuery = transformed.ok ? transformed.transformedQuery : input.prompt;
  const { merged, denseCount, sparseCount, vectorSearchMs, sparseSearchMs } =
    await retrieve(queryVector, sparseQuery, settings);

  // ── 4. Rerank (optional, capped, fallback to retrieval order) ─────────────
  const rerankQuery = transformed.ok ? transformed.transformedQuery : input.prompt;
  const tR = Date.now();
  const { ranked, ran: rerankRan } = await rerank(rerankQuery, merged, settings);
  const rerankMs = Date.now() - tR;
  if (rerankRan) llmCalls++;

  // ── 5. Assemble context + groundedPrompt ──────────────────────────────────
  const tA = Date.now();
  const { structuredContext, groundedPrompt } = assemble(input.prompt, transformed, ranked, topK);
  const assembleMs = Date.now() - tA;

  const totalMs = Date.now() - t0;

  log.info(
    {
      step: "enhance",
      totalMs,
      queryTransformMs,
      embeddingMs,
      vectorSearchMs,
      rerankMs,
      llmCalls,
      api: structuredContext.apiExamples.length,
      scripts: structuredContext.similarScripts.length,
      query: input.prompt.slice(0, 80),
    },
    "Enhance complete"
  );

  return {
    groundedPrompt,
    structuredContext,
    retrievalTrace: {
      denseCandidates: denseCount,
      sparseCandidates: sparseCount,
      mergedCandidates: merged.length,
      afterRerank: structuredContext.apiExamples.length + structuredContext.similarScripts.length,
      embedModel: config.EMBEDDER_MODEL,
      rerankModel: rerankRan ? settings.reranker.model : "none",
      store: config.VECTOR_STORE,
      queryTransformed: transformed.ok,
      stages: {
        queryTransform: settings.stages.queryTransform,
        sparse: settings.stages.sparse,
        rerank: settings.stages.rerank,
      },
    },
    execution: {
      totalMs,
      queryTransformMs,
      embeddingMs,
      vectorSearchMs,
      sparseSearchMs,
      rerankMs,
      assembleMs,
      llmCalls,
    },
  };
}
