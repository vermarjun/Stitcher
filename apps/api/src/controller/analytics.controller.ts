/**
 * Analytics ingestion — public, batched, fire-and-forget.
 *
 * POST /api/analytics/collect
 *   body: { anonId, sessionId, events: [{ type, page, section?, action?,
 *           durationMs?, ts?, meta? }] }
 *
 * Accepts events from BOTH logged-in (Bearer token → userId attached) and
 * anonymous visitors (token absent → userId null, tracked by anonId). Never
 * 401s; auth is best-effort so pre-login funnel activity is still captured.
 * Returns 204 immediately; the insert runs detached so it never slows the page.
 *
 * Hardening: hard caps on batch size + string lengths; unknown event types are
 * dropped; durationMs is clamped by the schema. This endpoint is unauthenticated
 * so it must be cheap and impossible to abuse into heavy work.
 */

import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config";
import AnalyticsEvent, { ANALYTICS_EVENT_TYPES, AnalyticsEventType } from "../model/analyticsEvent.model";
import User from "../model/user.model";
import logger from "../util/logger.util";

const MAX_EVENTS_PER_BATCH = 50;
const MAX_STR = 256;

const VALID_TYPES = new Set<string>(ANALYTICS_EVENT_TYPES);

function clampStr(v: unknown, max = MAX_STR): string | undefined {
    if (typeof v !== "string") return undefined;
    const s = v.trim();
    if (!s) return undefined;
    return s.length > max ? s.slice(0, max) : s;
}

/**
 * Normalise a route path so dynamic ids collapse into a single bucket:
 *   /dashboard/68c8...   → /dashboard/:id
 *   /home/projects/abc   → /home/projects/:id
 * Keeps cardinality low so "top pages" is meaningful.
 */
function normalisePage(raw: unknown): string {
    let p = clampStr(raw, 200) ?? "/";
    // strip query/hash
    p = p.split("?")[0]!.split("#")[0]!;
    // collapse 24-hex (mongo ids) and long numeric/uuid-ish segments
    p = p
        .split("/")
        .map((seg) =>
            /^[0-9a-f]{24}$/i.test(seg) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) ||
            /^\d{6,}$/.test(seg)
                ? ":id"
                : seg
        )
        .join("/");
    return p || "/";
}

/** Best-effort decode of the Bearer token → userId (never throws). */
function userIdFromReq(req: Request): string | null {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) return null;
    try {
        const decoded = jwt.verify(h.slice(7), JWT_CONFIG.secret);
        if (typeof decoded !== "string" && decoded && "userId" in decoded) {
            return (decoded as { userId: string }).userId;
        }
    } catch {
        /* ignore — anonymous */
    }
    return null;
}

export async function collectAnalytics(req: Request, res: Response): Promise<Response> {
    try {
        const body = req.body as {
            anonId?: unknown;
            sessionId?: unknown;
            events?: unknown;
        };

        const anonId = clampStr(body.anonId, 64);
        const sessionId = clampStr(body.sessionId, 64);
        const rawEvents = Array.isArray(body.events) ? body.events : [];

        if (!anonId || !sessionId || rawEvents.length === 0) {
            // Nothing usable — ack anyway so the client never retries-storms.
            return res.status(204).end();
        }

        const userId = userIdFromReq(req);

        // Resolve plan once (cheap, optional) for segment queries.
        let plan: string | undefined;
        if (userId) {
            try {
                const u = await User.findById(userId).select("plan").lean<{ plan?: string }>();
                plan = u?.plan;
            } catch { /* ignore */ }
        }

        const now = Date.now();
        const docs = rawEvents
            .slice(0, MAX_EVENTS_PER_BATCH)
            .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
            .map((e) => {
                const type = clampStr(e.type, 32);
                if (!type || !VALID_TYPES.has(type)) return null;
                // ts: accept client epoch ms but never trust the future / far past.
                let ts = now;
                const rawTs = typeof e.ts === "number" ? e.ts : Date.parse(String(e.ts ?? ""));
                if (Number.isFinite(rawTs) && rawTs > now - 24 * 3600_000 && rawTs <= now + 60_000) {
                    ts = rawTs;
                }
                const durationMs = typeof e.durationMs === "number" && e.durationMs >= 0
                    ? Math.min(e.durationMs, 6 * 60 * 60 * 1000)
                    : 0;
                return {
                    userId: userId ?? null,
                    anonId,
                    sessionId,
                    type: type as AnalyticsEventType,
                    page: normalisePage(e.page),
                    section: clampStr(e.section, 64),
                    action: clampStr(e.action, 64),
                    durationMs,
                    plan,
                    meta: (e.meta && typeof e.meta === "object" && !Array.isArray(e.meta))
                        ? (e.meta as Record<string, unknown>)
                        : undefined,
                    ts: new Date(ts),
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null);

        if (docs.length > 0) {
            // Detached insert — do not await; ack immediately.
            AnalyticsEvent.insertMany(docs, { ordered: false }).catch((err) => {
                logger.warn({ message: "[analytics] insert failed (non-fatal)", error: String(err) });
            });
        }

        return res.status(204).end();
    } catch (err) {
        logger.warn({ message: "[analytics] collect failed (non-fatal)", error: String(err) });
        return res.status(204).end();
    }
}
