import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { trace } from "@opentelemetry/api";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

export async function traceMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  request.traceId =
    (request.headers["x-trace-id"] as string | undefined) ??
    (request.headers["x-request-id"] as string | undefined) ??
    uuidv4();

  // Legacy bridge (OBSERVABILITY.md §3): stamp the human-facing X-Trace-Id onto
  // the active server span (created by Fastify auto-instrumentation, which has
  // already extracted the incoming W3C `traceparent`) so Tempo is searchable by it.
  trace.getActiveSpan()?.setAttribute("stitcher.trace_id", request.traceId);
}
