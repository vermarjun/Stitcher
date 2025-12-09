/**
 * Per-job typed event bus.
 *
 * Each job gets one EventEmitter instance. The SSE transport subscribes to it.
 * Events are also mirrored to Redis so reconnect-after-failover can replay
 * missed events using Last-Event-ID.
 */

import { EventEmitter } from "events";
import { AgentEvent } from "../graph/state.js";
import { getLogger } from "../logging.js";

const log = getLogger("events");

const JOB_TTL_MS = 30 * 60 * 1000; // clean up emitters after 30 min

class JobEventEmitter extends EventEmitter {
  readonly jobId: string;
  private readonly createdAt: number;
  private eventIndex = 0;

  constructor(jobId: string) {
    super();
    this.setMaxListeners(50);
    this.jobId = jobId;
    this.createdAt = Date.now();
  }

  emit(event: string, data?: unknown): boolean {
    return super.emit(event, data);
  }

  isStale(): boolean {
    return Date.now() - this.createdAt > JOB_TTL_MS;
  }

  nextEventId(): string {
    return `${this.jobId}:${this.eventIndex++}`;
  }
}

// Global registry of in-flight job emitters
const registry = new Map<string, JobEventEmitter>();

// Reap stale emitters every 5 min
setInterval(() => {
  for (const [jobId, emitter] of registry) {
    if (emitter.isStale()) {
      registry.delete(jobId);
      log.debug({ jobId }, "reaped stale emitter");
    }
  }
}, 5 * 60 * 1000).unref();

export function createEmitter(jobId: string): JobEventEmitter {
  const emitter = new JobEventEmitter(jobId);
  registry.set(jobId, emitter);
  return emitter;
}

export function getEmitter(jobId: string): JobEventEmitter | undefined {
  return registry.get(jobId);
}

export function removeEmitter(jobId: string): void {
  registry.delete(jobId);
}

/** Publish a typed event to the job emitter and return the event object. */
export function publishEvent(
  jobId: string,
  type: string,
  payload: Record<string, unknown> = {}
): AgentEvent {
  const event: AgentEvent = {
    type,
    jobId,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const emitter = registry.get(jobId);
  if (emitter) {
    emitter.emit("event", event);
  } else {
    log.warn({ jobId, type }, "publishEvent: no emitter found");
  }
  return event;
}
