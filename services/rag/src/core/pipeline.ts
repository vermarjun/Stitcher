import { SpanStatusCode } from "@opentelemetry/api";
import { transformQuery, embeddingTextFor } from "./query-transform.js";
import { embedQuery, embedQueryWithOverride, embedderInfo } from "../providers/embedder.js";
import { retrieve } from "./retrieve.js";
import { selectDiverse } from "./select.js";
import { assemble } from "./assemble.js";
import { resolveSettings, type ResolvedSettings } from "./settings.js";
import { config } from "../config.js";
import { log } from "../logger.js";
import { ragTracer, ragDurationHistogram } from "../observability/rag.js";
import type {
  EnhanceInput,
  EnhanceResult,
  ProviderConfig,
  PipelineTrace,
  TraceRetrieveCandidate,
} from "../types.js";

/**
 * End-to-end enhance pipeline:
 *   query transform → embed → dense (+ optional sparse/RRF) → rerank → assemble.
 * Every stage is timed and resilient; the query-transform and rerank stages
 * degrade gracefully so a single LLM hiccup never fails the request.
 *
 * Manual OTel spans are added for each internal stage so the /enhance call is
 * fully visible in the distributed trace (OBSERVABILITY_PLAN §3 Phase 1.3).
 */
export async function enhance(
  input: EnhanceInput,
  settings: ResolvedSettings = resolveSettings()
): Promise<EnhanceResult> {
  const t0 = Date.now();
  const topK = input.topK ?? settings.defaultTopK;
  const providerConfig: ProviderConfig | undefined = input.providerConfig;
  let llmCalls = 0;

  // Trace accumulator — filled defensively as each stage completes.
  const trace: PipelineTrace = {};

  // ── 1. Query transform (optional, timeout + raw fallback) ─────────────────
  const transformed = await ragTracer.startActiveSpan(
    "rag.query_transform",
    async (span) => {
      try {
        const tQ = Date.now();
        const result = await transformQuery(input.prompt, settings, providerConfig?.queryTransform);
        span.setAttribute("stitcher.rag.stage", "query_transform");
        span.setAttribute("stitcher.rag.query_transform.enabled", settings.stages.queryTransform);
        span.setAttribute("stitcher.rag.query_transform.ok", result.ok);
        span.setAttribute("stitcher.rag.query_transform.domain", result.domain ?? "");
        span.setAttribute("stitcher.rag.query_transform.complexity", result.estimatedComplexity ?? "");
        span.setAttribute("stitcher.rag.query_transform.suggested_apis_count", result.suggestedApis?.length ?? 0);
        span.setAttribute("stitcher.rag.query_transform.duration_ms", Date.now() - tQ);
        if (result.ok) llmCalls++;
        // Capture query-transform trace (LLM I/O captured inside transformQuery).
        if (result._trace) {
          trace.queryTransform = result._trace;
        } else if (!settings.stages.queryTransform) {
          // Stage disabled — record a minimal ran:false entry.
          trace.queryTransform = {
            ran: false,
            provider: "",
            model: "",
            systemPrompt: "",
            userPrompt: "",
            rawOutput: "",
            transformedQuery: input.prompt,
            requiredApis: [],
            requiredPlugins: [],
            tokensUsed: { input: 0, output: 0 },
            durationMs: 0,
          };
        }
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
      } finally {
        span.end();
      }
    }
  );

  // ── 2. Embed ──────────────────────────────────────────────────────────────
  const queryVector = await ragTracer.startActiveSpan(
    "rag.embed",
    async (span) => {
      try {
        const tE = Date.now();
        const vec = await embedQueryWithOverride(
          embeddingTextFor(input.prompt, transformed),
          providerConfig?.embedder
        );
        const embedDurationMs = Date.now() - tE;
        const embInfo = embedderInfo();
        span.setAttribute("stitcher.rag.stage", "embed");
        span.setAttribute("stitcher.rag.embed.model", config.EMBEDDER_MODEL);
        span.setAttribute("stitcher.rag.embed.dim", vec.length);
        span.setAttribute("stitcher.rag.embed.duration_ms", embedDurationMs);
        // Capture embed trace — no vectors.
        trace.embed = {
          provider: embInfo.provider,
          model: embInfo.model,
          dims: vec.length,
          durationMs: embedDurationMs,
        };
        span.setStatus({ code: SpanStatusCode.OK });
        return vec;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
      } finally {
        span.end();
      }
    }
  );

  // ── 3. Retrieve (dense + optional sparse → RRF) ───────────────────────────
  const sparseQuery = transformed.ok ? transformed.transformedQuery : input.prompt;

  /** Build a compact candidate entry (no embedding vectors, no full code). */
  function toTraceCandidate(sd: { doc: { id: string; title?: string; content?: string; fullyQualifiedName?: string; apisUsed?: string[] }; similarity: number; sparseScore?: number; fusedScore?: number }, score: number): TraceRetrieveCandidate {
    const rawTitle =
      sd.doc.title ||
      sd.doc.fullyQualifiedName ||
      sd.doc.content?.slice(0, 120) ||
      sd.doc.id;
    return {
      id: sd.doc.id,
      title: rawTitle.slice(0, 120),
      score: Math.round(score * 10000) / 10000,
      ...(sd.doc.apisUsed?.length ? { apisUsed: sd.doc.apisUsed } : {}),
    };
  }

  const retrieval = await ragTracer.startActiveSpan(
    "rag.retrieve",
    async (span) => {
      try {
        const tV = Date.now();
        const out = await retrieve(queryVector, sparseQuery, settings);
        span.setAttribute("stitcher.rag.stage", "retrieve");
        span.setAttribute("stitcher.rag.retrieve.dense_candidates", out.denseCount);
        span.setAttribute("stitcher.rag.retrieve.sparse_candidates", out.sparseCount);
        span.setAttribute("stitcher.rag.retrieve.merged_candidates", out.merged.length);
        span.setAttribute("stitcher.rag.retrieve.sparse_enabled", settings.stages.sparse);
        span.setAttribute("stitcher.rag.retrieve.vector_search_ms", out.vectorSearchMs);
        span.setAttribute("stitcher.rag.retrieve.sparse_search_ms", out.sparseSearchMs);
        span.setAttribute("stitcher.rag.retrieve.duration_ms", Date.now() - tV);
        // Capture retrieve trace — ids/titles/scores only, no vectors or full code.
        trace.retrieve = {
          searchQuery: sparseQuery,
          dense: out.denseRaw
            .slice(0, 20)
            .map((sd) => toTraceCandidate(sd, sd.similarity)),
          sparse: out.sparseRaw
            .slice(0, 20)
            .map((sd) => toTraceCandidate(sd, sd.sparseScore ?? 0)),
          merged: out.merged.map((sd) =>
            toTraceCandidate(sd, sd.fusedScore ?? sd.similarity)
          ),
          topK,
        };
        span.setStatus({ code: SpanStatusCode.OK });
        return out;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
      } finally {
        span.end();
      }
    }
  );
  const { merged, denseCount, sparseCount, vectorSearchMs, sparseSearchMs } = retrieval;

  // ── 4. Coverage-greedy selection (replaces LLM reranker per CONTRACT 1) ────
  // Rule-based: greedily pick examples that maximise distinct apisUsed coverage.
  // No LLM call. OTEL span renamed from rag.rerank → rag.select.
  const { selected: ranked, coveredApis, ran: rerankRan } = await ragTracer.startActiveSpan(
    "rag.select",
    async (span) => {
      try {
        const tR = Date.now();
        const out = selectDiverse(merged, Math.max(topK + 2, 8), Math.max(topK, 5));
        span.setAttribute("stitcher.rag.stage", "select");
        span.setAttribute("stitcher.rag.select.ran", out.ran);
        span.setAttribute("stitcher.rag.select.candidates_in", merged.length);
        span.setAttribute("stitcher.rag.select.candidates_out", out.selected.length);
        span.setAttribute("stitcher.rag.select.covered_apis", out.coveredApis.length);
        span.setAttribute("stitcher.rag.select.duration_ms", Date.now() - tR);
        // Capture select trace — ids/titles/apisUsed only, no code.
        trace.select = {
          method: "coverage-greedy",
          selected: out.selected.map((sd) => ({
            id: sd.doc.id,
            title: (sd.doc.title || sd.doc.fullyQualifiedName || sd.doc.id).slice(0, 120),
            apisUsed: sd.doc.apisUsed ?? [],
          })),
          coveredApis: out.coveredApis,
        };
        span.setStatus({ code: SpanStatusCode.OK });
        return out;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
      } finally {
        span.end();
      }
    }
  );

  // ── 5. Assemble context + groundedPrompt ──────────────────────────────────
  const { structuredContext, groundedPrompt } = await ragTracer.startActiveSpan(
    "rag.assemble",
    async (span) => {
      try {
        const tA = Date.now();
        const out = assemble(input.prompt, transformed, ranked, topK);
        span.setAttribute("stitcher.rag.stage", "assemble");
        span.setAttribute("stitcher.rag.assemble.top_k", topK);
        span.setAttribute("stitcher.rag.assemble.api_examples", out.structuredContext.apiExamples.length);
        span.setAttribute("stitcher.rag.assemble.similar_scripts", out.structuredContext.similarScripts.length);
        span.setAttribute("stitcher.rag.assemble.grounded_prompt_len", out.groundedPrompt.length);
        span.setAttribute("stitcher.rag.assemble.duration_ms", Date.now() - tA);
        span.setStatus({ code: SpanStatusCode.OK });
        return out;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
        throw err;
      } finally {
        span.end();
      }
    }
  );

  const totalMs = Date.now() - t0;

  // Emit the stitcher.rag.duration histogram (OBSERVABILITY_PLAN §3 Phase 1.3).
  ragDurationHistogram.record(totalMs, {
    query_transform: String(settings.stages.queryTransform),
    rerank: String(settings.stages.rerank),
    sparse: String(settings.stages.sparse),
  });

  log.info(
    {
      step: "enhance",
      totalMs,
      vectorSearchMs,
      coveredApis: coveredApis.length,
      llmCalls,
      api: structuredContext.apiExamples.length,
      scripts: structuredContext.similarScripts.length,
      requiredApis: structuredContext.requiredApis.length,
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
      rerankModel: "coverage-greedy",
      store: config.VECTOR_STORE,
      queryTransformed: transformed.ok,
      coveredApis: coveredApis.length,
      stages: {
        queryTransform: settings.stages.queryTransform,
        sparse: settings.stages.sparse,
        rerank: false, // replaced by coverage-greedy selection (no LLM)
      },
    },
    execution: {
      totalMs,
      queryTransformMs: 0, // timing tracked in span
      embeddingMs: 0,      // timing tracked in span
      vectorSearchMs,
      sparseSearchMs,
      rerankMs: 0,         // selection is synchronous (<1ms); kept for back-compat
      assembleMs: 0,       // timing tracked in span
      llmCalls,
    },
    trace,
  };
}
