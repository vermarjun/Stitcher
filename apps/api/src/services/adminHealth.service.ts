/**
 * Admin health poller — §2c Health+Actions.
 *
 * Probes mongo, redis, agent, render, rag, and optionally qdrant every 30s.
 * Results are cached in memory and served via getHealthSnapshot().
 *
 * Design constraints:
 *   - NEVER crashes the process: every probe and the scheduler itself is wrapped
 *     in try/catch.
 *   - No new Redis connections: reuses pubClient from queue/connection (ioredis).
 *   - Each probe result: { name, status: 'up'|'degraded'|'down', latencyMs?,
 *     detail?, checkedAt }.
 *   - status mapping:
 *       client returns degraded-equivalent status → 'degraded'
 *       throw / timeout / non-ok → 'down'
 *       ok → 'up'
 */

import mongoose from "mongoose";
import axios from "axios";
import { agentClient } from "./agentClient";
import { renderClient } from "./renderClient";
import { ragClient } from "./ragClient";
import { pubClient } from "../queue/connection";
import logger from "../util/logger.util";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceHealth {
    name: string;
    status: "up" | "degraded" | "down";
    latencyMs?: number;
    detail?: string;
    checkedAt: string; // ISO string
}

export interface HealthSnapshot {
    services: ServiceHealth[];
    generatedAt: string; // ISO string
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let cachedSnapshot: HealthSnapshot | null = null;
let pollerHandle: ReturnType<typeof setInterval> | null = null;

const POLL_INTERVAL_MS = 30_000;

// ─── Individual probes ────────────────────────────────────────────────────────

async function probeMongo(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        if (!mongoose.connection.db) {
            return {
                name: "mongo",
                status: "down",
                detail: "no active connection",
                checkedAt: new Date().toISOString(),
            };
        }
        await mongoose.connection.db.admin().ping();
        return {
            name: "mongo",
            status: "up",
            latencyMs: Date.now() - start,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "mongo",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

async function probeRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const pong = await pubClient.ping();
        const ok = pong === "PONG";
        return {
            name: "redis",
            status: ok ? "up" : "degraded",
            latencyMs: Date.now() - start,
            detail: ok ? undefined : `unexpected ping response: ${pong}`,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "redis",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

async function probeAgent(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const resp = await agentClient.health();
        // AgentHealthResponse.status is a string; treat anything besides "ok"/"up"
        // as degraded. "degraded" maps to degraded.
        const raw = (resp.status ?? "").toLowerCase();
        let status: ServiceHealth["status"] = "up";
        if (raw === "degraded") status = "degraded";
        else if (raw !== "ok" && raw !== "up") status = "degraded";
        return {
            name: "agent",
            status,
            latencyMs: Date.now() - start,
            detail: raw !== "ok" && raw !== "up" ? `status=${resp.status}` : undefined,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "agent",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

async function probeRender(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const resp = await renderClient.health();
        // RenderHealthResponse.status is 'ok' | 'degraded' | 'down'
        const raw = resp.status;
        let status: ServiceHealth["status"] = "up";
        if (raw === "degraded") status = "degraded";
        else if (raw === "down") status = "down";
        // render client uses 'ok' (not 'up') for healthy
        return {
            name: "render",
            status,
            latencyMs: Date.now() - start,
            detail: raw !== "ok" ? `status=${raw}` : undefined,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "render",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

async function probeRag(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
        const resp = await ragClient.health();
        // RagHealthResponse.status is a plain string
        const raw = (resp.status ?? "").toLowerCase();
        let status: ServiceHealth["status"] = "up";
        if (raw === "degraded") status = "degraded";
        else if (raw !== "ok" && raw !== "up") status = "degraded";
        return {
            name: "rag",
            status,
            latencyMs: Date.now() - start,
            detail: raw !== "ok" && raw !== "up" ? `status=${resp.status}` : undefined,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "rag",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

async function probeQdrant(): Promise<ServiceHealth> {
    const qdrantUrl = process.env.QDRANT_URL;
    const start = Date.now();
    try {
        const res = await axios.get(`${qdrantUrl}/healthz`, { timeout: 5_000 });
        const ok = res.status >= 200 && res.status < 300;
        return {
            name: "qdrant",
            status: ok ? "up" : "degraded",
            latencyMs: Date.now() - start,
            detail: !ok ? `HTTP ${res.status}` : undefined,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            name: "qdrant",
            status: "down",
            latencyMs: Date.now() - start,
            detail: String(err),
            checkedAt: new Date().toISOString(),
        };
    }
}

// ─── Core probe runner ────────────────────────────────────────────────────────

async function runProbes(): Promise<HealthSnapshot> {
    const probes: Array<Promise<ServiceHealth>> = [
        probeMongo(),
        probeRedis(),
        probeAgent(),
        probeRender(),
        probeRag(),
    ];

    if (process.env.QDRANT_URL) {
        probes.push(probeQdrant());
    }

    // Run all probes concurrently; individual errors are caught inside each probe.
    const services = await Promise.all(probes);

    return {
        services,
        generatedAt: new Date().toISOString(),
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the most recent cached snapshot. If no snapshot exists yet (poller
 * not started or first tick hasn't fired), runs one probe on demand.
 */
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
    if (cachedSnapshot) return cachedSnapshot;
    // Run once on demand — wrap in try/catch so callers always get a result.
    try {
        cachedSnapshot = await runProbes();
    } catch (err) {
        logger.error({ message: "adminHealth: on-demand probe failed", error: String(err) });
        // Return a safe fallback
        cachedSnapshot = {
            services: [],
            generatedAt: new Date().toISOString(),
        };
    }
    return cachedSnapshot;
}

/**
 * Start the 30-second health poller. Runs one probe immediately on start.
 * Safe to call multiple times — only one interval is active at a time.
 */
export function startHealthPoller(): void {
    if (pollerHandle !== null) return; // already running

    // Run immediately
    void (async () => {
        try {
            cachedSnapshot = await runProbes();
        } catch (err) {
            logger.error({ message: "adminHealth: initial probe failed", error: String(err) });
        }
    })();

    pollerHandle = setInterval(() => {
        void (async () => {
            try {
                cachedSnapshot = await runProbes();
            } catch (err) {
                logger.error({ message: "adminHealth: poll tick failed", error: String(err) });
            }
        })();
    }, POLL_INTERVAL_MS);

    // Unref so the interval does not prevent graceful shutdown
    if (pollerHandle.unref) pollerHandle.unref();
}

/**
 * Stop the health poller (called during graceful shutdown).
 */
export function stopHealthPoller(): void {
    if (pollerHandle !== null) {
        clearInterval(pollerHandle);
        pollerHandle = null;
    }
}
