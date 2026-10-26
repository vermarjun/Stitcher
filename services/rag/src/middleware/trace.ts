/**
 * Trace-context continuation middleware for ManimRAG.
 *
 * The API sends two headers on every /enhance call (see ragClient.ts:142):
 *   - `traceparent`  — W3C Trace Context; extracted automatically by the Fastify
 *     auto-instrumentation registered in instrumentation.ts. No manual action needed.
 *   - `X-Trace-Id`   — human-facing Stitcher trace ID (jobId/traceId) for log
 *     correlation and Admin deep-linking.
 *
 * This middleware reads `X-Trace-Id` and stamps it as `stitcher.trace_id` on the
 * active server span (already a child of the API's root span thanks to `traceparent`
 * auto-extraction). This mirrors the pattern in Manim-Agent-Service/src/middleware/trace.ts
 * (OBSERVABILITY_PLAN §3 Phase 1.2).
 */

import { type FastifyRequest, type FastifyReply } from "fastify";
import { trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    /** Stitcher human-facing trace ID for log correlation. */
    stitcherTraceId: string;
  }
}

export async function traceMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const header = request.headers["x-trace-id"];
  request.stitcherTraceId =
    (Array.isArray(header) ? header[0] : header) ??
    (request.headers["x-request-id"] as string | undefined) ??
    randomUUID();

  // Stamp the human-facing trace ID onto the active server span so Tempo is
  // searchable by it and log lines can be correlated with the trace waterfall.
  trace.getActiveSpan()?.setAttribute("stitcher.trace_id", request.stitcherTraceId);
}
