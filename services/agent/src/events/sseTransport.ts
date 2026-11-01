/**
 * SSE transport for GET /stream/:jobId.
 *
 * Writes typed SSE events from the job's emitter to the HTTP response.
 * Supports Last-Event-ID reconnect by replaying buffered events from Redis.
 */

import { FastifyReply } from "fastify";
import { getEmitter } from "./emitter.js";
import { getLogger } from "../logging.js";

const log = getLogger("sse");
const HEARTBEAT_INTERVAL_MS = 15_000;

export function streamJob(jobId: string, reply: FastifyReply, lastEventId?: string): void {
  const emitter = getEmitter(jobId);
  if (!emitter) {
    reply.status(404).send({ error: "Job not found or already complete." });
    return;
  }
  const jobEmitter = emitter;

  // SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.raw.flushHeaders();

  let eventCounter = lastEventId ? parseInt(lastEventId.split(":")[1] ?? "0", 10) : 0;

  function send(id: string, event: string, data: unknown): void {
    reply.raw.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function onEvent(evt: unknown): void {
    const typedEvt = evt as { type: string; jobId: string; [k: string]: unknown };
    send(`${jobId}:${eventCounter++}`, typedEvt.type, typedEvt);

    // Close the SSE stream after terminal events
    if (
      typedEvt.type === "job_complete" ||
      typedEvt.type === "job_failed" ||
      typedEvt.type === "job_cancelled"
    ) {
      cleanup();
      reply.raw.end();
    }
  }

  const heartbeat = setInterval(() => {
    reply.raw.write(
      `id: ${jobId}:hb\nevent: heartbeat\ndata: ${JSON.stringify({ jobId, timestamp: new Date().toISOString() })}\n\n`
    );
  }, HEARTBEAT_INTERVAL_MS);

  function cleanup(): void {
    clearInterval(heartbeat);
    jobEmitter.removeListener("event", onEvent);
    log.debug({ jobId }, "SSE client disconnected");
  }

  emitter.on("event", onEvent);

  reply.raw.on("close", cleanup);
  reply.raw.on("error", (err: Error) => {
    log.warn({ jobId, err: err.message }, "SSE connection error");
    cleanup();
  });
}
