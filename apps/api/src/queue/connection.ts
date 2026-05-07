/**
 * BullMQ-compatible ioredis connections.
 *
 * BullMQ requires two specific connection options:
 *   - maxRetriesPerRequest: null  — tells ioredis not to give up on queued
 *     commands while the connection is being established / re-established.
 *     Without this BullMQ worker commands would fail on startup races.
 *   - enableReadyCheck: false     — BullMQ manages readiness itself; having
 *     ioredis block on the READY event can cause deadlocks inside the worker.
 *
 * We export two separate connections:
 *   redisConnection — used by Queue and Worker (BullMQ-managed lifecycle)
 *   pubClient       — used only for PUBLISH; a plain ioredis instance so the
 *                     existing redis.util.ts pSubscribe pattern can pick up
 *                     events on chat:{chatId} channels.
 */

import Redis from "ioredis";
import { config } from "../config";

const SHARED_OPTIONS = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    // BullMQ requirements:
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
};

/** BullMQ Queue / Worker connection (singleton). */
export const redisConnection = new Redis(SHARED_OPTIONS);

redisConnection.on("error", (err) => {
    // Log but don't crash — BullMQ will retry internally
    // eslint-disable-next-line no-console
    console.error("[redis:bullmq] connection error", String(err));
});

/**
 * Publisher client for progress events.
 * Separate from redisConnection so BullMQ internals don't interfere with PUBLISH.
 */
export const pubClient = new Redis(SHARED_OPTIONS);

pubClient.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis:pub] connection error", String(err));
});
