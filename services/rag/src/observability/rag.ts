/**
 * RAG-service observability helpers.
 *
 * Provides:
 *   - `ragTracer`  — named tracer for manual spans inside the /enhance pipeline.
 *   - `ragMeter`   — named meter for RAG-specific metrics.
 *   - `ragDuration` histogram — `stitcher.rag.duration` (OBSERVABILITY_PLAN §3 Phase 1.3).
 *   - `tokenCounter` — `stitcher.llm.tokens` with attributes {service, model, role, type}
 *       SAME counter name/shape as Manim-Agent-Service/src/observability/llm.ts so the
 *       existing Prometheus aggregation picks it up automatically.
 *   - `recordLlmTokens()` — call after every chatStructured / chatText call with the
 *       raw OpenAI-compat `usage` object returned by the LLM.
 *
 * RAG's LLM calls (query-transform + reranker) use a raw OpenAI-compat fetch,
 * not LangChain, so the agent's `extractUsage()` (which reads LangChain BaseMessage
 * usage_metadata) doesn't apply. Instead we read `data.usage` from the fetch
 * response — the same `{ prompt_tokens, completion_tokens }` shape all OpenAI-
 * compatible providers return.
 */

import { trace, metrics } from "@opentelemetry/api";

const SERVICE = "stitcher-rag";

export const ragTracer = trace.getTracer(SERVICE);
export const ragMeter = metrics.getMeter(SERVICE);

/**
 * `stitcher.rag.duration` — end-to-end /enhance duration in milliseconds.
 * Mirrors the per-stage histogram shape used by the agent's withStep().
 */
export const ragDurationHistogram = ragMeter.createHistogram(
  "stitcher.rag.duration",
  {
    description: "End-to-end duration of the ManimRAG /enhance pipeline in milliseconds",
    unit: "ms",
  }
);

/**
 * `stitcher.llm.tokens` — EXACT same counter name + attribute schema as
 * Manim-Agent-Service/src/observability/llm.ts so Prometheus/Grafana
 * aggregations built for the agent pick up RAG's token spend automatically.
 *
 * Attributes: { service, model, role, type: "input" | "output" }
 *   - role values for RAG: "query_transform" | "reranker"
 */
export const tokenCounter = ragMeter.createCounter("stitcher.llm.tokens", {
  description: "LLM tokens consumed by the Stitcher RAG service",
  unit: "{token}",
});

/**
 * Record token usage from an OpenAI-compat completion response's `usage` field.
 *
 * @param model    The model that was called (e.g. "glm-5.1", "deepseek-v4-flash").
 * @param role     The RAG role: "query_transform" or "reranker".
 * @param usage    The `usage` object from the LLM API response, if present.
 */
export function recordLlmTokens(
  model: string,
  role: "query_transform" | "reranker",
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null
): void {
  if (!usage) return;
  const inputTok = usage.prompt_tokens ?? 0;
  const outputTok = usage.completion_tokens ?? 0;
  if (inputTok > 0) {
    tokenCounter.add(inputTok, { service: SERVICE, model, role, type: "input" });
  }
  if (outputTok > 0) {
    tokenCounter.add(outputTok, { service: SERVICE, model, role, type: "output" });
  }
}
