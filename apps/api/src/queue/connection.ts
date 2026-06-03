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

/**
 * Resilient retry strategy: NEVER give up reconnecting. A transient DNS failure
 * (getaddrinfo ENOTFOUND on a managed Redis Cloud host) or a network blip must
 * not permanently kill the BullMQ workers — they must keep retrying until the
 * host resolves again. Exponential-ish backoff capped at 5s so we don't spin
 * hot, but `null` is never returned (returning null stops reconnection).
 */
function retryStrategy(times: number): number {
    const delay = Math.min(times * 200, 5000);
    if (times === 1 || times % 10 === 0) {
        // eslint-disable-next-line no-console
        console.warn(`[redis] reconnect attempt ${times} (next in ${delay}ms)`);
    }
    return delay;
}

/**
 * Reconnect when the server reports it is in a read-only / failover state.
 * Returning true tells ioredis to reconnect AND re-queue the in-flight command.
 */
function reconnectOnError(err: Error): boolean {
    const msg = String(err?.message ?? err);
    return /READONLY|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(msg);
}

const SHARED_OPTIONS = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
    // BullMQ requirements:
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    // Resilience:
    retryStrategy,
    reconnectOnError,
    connectTimeout: 15_000,      // allow slow DNS / TLS handshakes
    keepAlive: 30_000,           // detect dead sockets behind NAT/LB
    enableOfflineQueue: true,    // queue commands during a blip instead of erroring
};

/** BullMQ Queue / Worker connection (singleton). */
export const redisConnection = new Redis(SHARED_OPTIONS);

redisConnection.on("error", (err) => {
    // Log but don't crash — the retryStrategy keeps reconnecting indefinitely.
    // eslint-disable-next-line no-console
    console.error("[redis:bullmq] connection error", String(err));
});
redisConnection.on("reconnecting", () => {
    // eslint-disable-next-line no-console
    console.warn("[redis:bullmq] reconnecting…");
});
redisConnection.on("ready", () => {
    // eslint-disable-next-line no-console
    console.info("[redis:bullmq] connection ready");
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
