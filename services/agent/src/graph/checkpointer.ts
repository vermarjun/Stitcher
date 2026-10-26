/**
 * Redis-backed job state store.
 *
 * LangGraph's built-in checkpointer interface requires a complex serialization
 * layer that LangGraph JS's Redis adapter is still catching up on.
 * We implement a lightweight job-level checkpoint: the full serialised GraphState
 * is stored per jobId with a 2-hour TTL. This covers crash-resume and the
 * GET /jobs/:jobId polling endpoint.
 *
 * Graph-level per-step checkpointing (step-by-step resume mid-graph) can be
 * added later by wiring LangGraph's MemorySaver or the official Redis adapter
 * once it stabilises.
 */

import IORedis from "ioredis";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("checkpointer");
const JOB_TTL_SEC = 2 * 60 * 60; // 2 hours

let _redis: IORedis | null = null;

function redis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    _redis.on("error", (err: Error) => log.warn({ err: err.message }, "Redis error"));
  }
  return _redis;
}

export async function saveJob(jobId: string, state: unknown): Promise<void> {
  try {
    await redis().setex(`job:${jobId}`, JOB_TTL_SEC, JSON.stringify(state));
  } catch (err) {
    log.warn({ jobId, err }, "Failed to save job checkpoint");
  }
}

export async function loadJob(jobId: string): Promise<unknown | null> {
  try {
    const raw = await redis().get(`job:${jobId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    log.warn({ jobId, err }, "Failed to load job checkpoint");
    return null;
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  try {
    await redis().del(`job:${jobId}`);
  } catch (err) {
    log.warn({ jobId, err }, "Failed to delete job checkpoint");
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const r = redis();
    await r.connect().catch(() => {}); // no-op if already connected
    await r.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
