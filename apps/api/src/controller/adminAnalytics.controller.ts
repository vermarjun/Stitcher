/**
 * Admin user-behaviour analytics — computed from the AnalyticsEvent stream.
 *
 * Identity = the logged-in userId when present, else the anonId (so anonymous
 * and logged-in activity for the same browser collapse to one person).
 *
 * GET /admin/metrics/analytics/overview?from&to
 *   active users (range / today / 7d / 30d), sessions, avg session length,
 *   total active hours, page views, new-vs-returning, DAU series (zero-filled).
 * GET /admin/metrics/analytics/pages?from&to
 *   top pages + sections by views, unique users, avg time-on-page.
 * GET /admin/metrics/analytics/retention?from&to
 *   recurrent users (≥3 active days), stickiness (DAU/MAU), simple D1/D7 return.
 * GET /admin/metrics/analytics/users?from&to&limit
 *   per-user table: sessions, total active time, days active, last seen.
 */

import { Request, Response } from "express";
import AnalyticsEvent from "../model/analyticsEvent.model";
import User from "../model/user.model";
import logger from "../util/logger.util";

const DAY = 24 * 3600_000;

function parseRange(req: Request): { from: Date; to: Date } {
    const now = Date.now();
    const toRaw = Date.parse(String(req.query.to ?? ""));
    const fromRaw = Date.parse(String(req.query.from ?? ""));
    const to = Number.isFinite(toRaw) ? new Date(toRaw) : new Date(now);
    const from = Number.isFinite(fromRaw) ? new Date(fromRaw) : new Date(now - 30 * DAY);
    return { from, to };
}

// identity = string(userId) || anonId — used as the grouping key everywhere.
const IDENTITY = { $ifNull: [{ $toString: "$userId" }, "$anonId"] };

/** Zero-fill a {date->value} map across [from,to] inclusive (UTC days). */
function zeroFillDays(map: Map<string, number>, from: Date, to: Date): Array<{ date: string; count: number }> {
    const out: Array<{ date: string; count: number }> = [];
    const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    for (let d = start.getTime(); d <= end.getTime(); d += DAY) {
        const key = new Date(d).toISOString().slice(0, 10);
        out.push({ date: key, count: map.get(key) ?? 0 });
    }
    return out;
}

export async function getAnalyticsOverview(req: Request, res: Response): Promise<Response> {
    const { from, to } = parseRange(req);
    const now = Date.now();
    try {
        const [rangeStats, todayIds, d7Ids, d30Ids, sessionStats, dauRows, firstSeenRows] = await Promise.all([
            // distinct identities + total active ms + page views in range
            AnalyticsEvent.aggregate([
                { $match: { ts: { $gte: from, $lte: to } } },
                { $group: { _id: null,
                    ids: { $addToSet: IDENTITY },
                    activeMs: { $sum: { $ifNull: ["$durationMs", 0] } },
                    pageViews: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
                } },
            ]),
            AnalyticsEvent.distinct("anonId", { ts: { $gte: new Date(now - DAY) } }),
            AnalyticsEvent.distinct("anonId", { ts: { $gte: new Date(now - 7 * DAY) } }),
            AnalyticsEvent.distinct("anonId", { ts: { $gte: new Date(now - 30 * DAY) } }),
            // sessions: distinct sessionId + active ms per session
            AnalyticsEvent.aggregate([
                { $match: { ts: { $gte: from, $lte: to } } },
                { $group: { _id: "$sessionId", activeMs: { $sum: { $ifNull: ["$durationMs", 0] } } } },
                { $group: { _id: null, sessions: { $sum: 1 }, totalMs: { $sum: "$activeMs" } } },
            ]),
            // DAU series: distinct identity per UTC day
            AnalyticsEvent.aggregate([
                { $match: { ts: { $gte: from, $lte: to } } },
                { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } }, id: IDENTITY } } },
                { $group: { _id: "$_id.day", count: { $sum: 1 } } },
            ]),
            // first-seen per identity (to classify new vs returning within range)
            AnalyticsEvent.aggregate([
                { $group: { _id: IDENTITY, first: { $min: "$ts" } } },
            ]),
        ]);

        const stats = rangeStats[0] ?? { ids: [], activeMs: 0, pageViews: 0 };
        const sess = sessionStats[0] ?? { sessions: 0, totalMs: 0 };
        const activeIds: string[] = stats.ids ?? [];
        const activeSet = new Set(activeIds);

        // new vs returning: of identities active in range, how many were first-seen
        // within the range (new) vs before it (returning).
        let newUsers = 0;
        for (const r of firstSeenRows) {
            if (activeSet.has(r._id) && r.first >= from) newUsers++;
        }
        const returning = activeIds.length - newUsers;

        const dauMap = new Map<string, number>();
        for (const r of dauRows) dauMap.set(r._id, r.count);

        return res.status(200).json({
            range: { from: from.toISOString(), to: to.toISOString() },
            activeUsers: { range: activeIds.length, dau: todayIds.length, wau: d7Ids.length, mau: d30Ids.length },
            sessions: sess.sessions,
            avgSessionMin: sess.sessions ? Number((sess.totalMs / sess.sessions / 60000).toFixed(1)) : 0,
            totalActiveHours: Number((stats.activeMs / 3600_000).toFixed(1)),
            avgMinutesPerUser: activeIds.length ? Number((stats.activeMs / activeIds.length / 60000).toFixed(1)) : 0,
            pageViews: stats.pageViews,
            newUsers,
            returningUsers: returning < 0 ? 0 : returning,
            stickiness: d30Ids.length ? Number((todayIds.length / d30Ids.length).toFixed(3)) : 0, // DAU/MAU
            dauSeries: zeroFillDays(dauMap, from, to),
        });
    } catch (err) {
        logger.error({ message: "getAnalyticsOverview failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to compute analytics overview" } });
    }
}

export async function getAnalyticsPages(req: Request, res: Response): Promise<Response> {
    const { from, to } = parseRange(req);
    try {
        const [pages, sections] = await Promise.all([
            AnalyticsEvent.aggregate([
                { $match: { ts: { $gte: from, $lte: to }, page: { $ne: "" } } },
                { $group: {
                    _id: "$page",
                    views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
                    activeMs: { $sum: { $ifNull: ["$durationMs", 0] } },
                    users: { $addToSet: IDENTITY },
                } },
                { $project: { page: "$_id", _id: 0, views: 1, activeMs: 1, uniqueUsers: { $size: "$users" } } },
                { $sort: { views: -1 } },
                { $limit: 30 },
            ]),
            AnalyticsEvent.aggregate([
                { $match: { ts: { $gte: from, $lte: to }, section: { $nin: [null, ""] } } },
                { $group: {
                    _id: "$section",
                    events: { $sum: 1 },
                    activeMs: { $sum: { $ifNull: ["$durationMs", 0] } },
                    users: { $addToSet: IDENTITY },
                } },
                { $project: { section: "$_id", _id: 0, events: 1, activeMs: 1, uniqueUsers: { $size: "$users" } } },
                { $sort: { activeMs: -1 } },
                { $limit: 30 },
            ]),
        ]);

        return res.status(200).json({
            range: { from: from.toISOString(), to: to.toISOString() },
            pages: pages.map((p) => ({
                page: p.page,
                views: p.views,
                uniqueUsers: p.uniqueUsers,
                avgSecOnPage: p.views ? Number((p.activeMs / p.views / 1000).toFixed(0)) : 0,
                totalMinutes: Number((p.activeMs / 60000).toFixed(1)),
            })),
            sections: sections.map((s) => ({
                section: s.section,
                events: s.events,
                uniqueUsers: s.uniqueUsers,
                totalMinutes: Number((s.activeMs / 60000).toFixed(1)),
            })),
        });
    } catch (err) {
        logger.error({ message: "getAnalyticsPages failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to compute page analytics" } });
    }
}

export async function getAnalyticsRetention(req: Request, res: Response): Promise<Response> {
    const { from, to } = parseRange(req);
    try {
        // active-days per identity within range
        const perId = await AnalyticsEvent.aggregate([
            { $match: { ts: { $gte: from, $lte: to } } },
            { $group: { _id: { id: IDENTITY, day: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } } } } },
            { $group: { _id: "$_id.id", days: { $sum: 1 } } },
        ]);
        const total = perId.length;
        let recurrent = 0;          // ≥3 active days
        let returningTwoPlus = 0;   // ≥2 active days
        const dist = { "1": 0, "2": 0, "3-5": 0, "6+": 0 };
        for (const r of perId) {
            if (r.days >= 3) recurrent++;
            if (r.days >= 2) returningTwoPlus++;
            if (r.days === 1) dist["1"]++;
            else if (r.days === 2) dist["2"]++;
            else if (r.days <= 5) dist["3-5"]++;
            else dist["6+"]++;
        }

        return res.status(200).json({
            range: { from: from.toISOString(), to: to.toISOString() },
            totalUsers: total,
            recurrentUsers: recurrent,                                  // active 3+ distinct days
            recurrentRate: total ? Number((recurrent / total).toFixed(3)) : 0,
            returningUsers: returningTwoPlus,                           // active 2+ distinct days
            returningRate: total ? Number((returningTwoPlus / total).toFixed(3)) : 0,
            activeDaysDistribution: dist,
        });
    } catch (err) {
        logger.error({ message: "getAnalyticsRetention failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to compute retention" } });
    }
}

export async function getAnalyticsUsers(req: Request, res: Response): Promise<Response> {
    const { from, to } = parseRange(req);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
    try {
        const rows = await AnalyticsEvent.aggregate([
            { $match: { ts: { $gte: from, $lte: to } } },
            { $group: {
                _id: IDENTITY,
                userId: { $first: "$userId" },
                activeMs: { $sum: { $ifNull: ["$durationMs", 0] } },
                sessions: { $addToSet: "$sessionId" },
                days: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } } },
                pageViews: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
                lastSeen: { $max: "$ts" },
            } },
            { $project: {
                _id: 0, identity: "$_id", userId: 1, activeMs: 1, pageViews: 1, lastSeen: 1,
                sessions: { $size: "$sessions" }, daysActive: { $size: "$days" },
            } },
            { $sort: { activeMs: -1 } },
            { $limit: limit },
        ]);

        // enrich logged-in users with name/email/plan
        const userIds = rows.map((r) => r.userId).filter(Boolean);
        const users = await User.find({ _id: { $in: userIds } }).select("username email plan").lean<Array<{ _id: unknown; username?: string; email?: string; plan?: string }>>();
        const umap = new Map(users.map((u) => [String(u._id), u]));

        return res.status(200).json({
            range: { from: from.toISOString(), to: to.toISOString() },
            users: rows.map((r) => {
                const u = r.userId ? umap.get(String(r.userId)) : undefined;
                return {
                    identity: r.identity,
                    userId: r.userId ? String(r.userId) : null,
                    username: u?.username ?? (r.userId ? "(unknown)" : "anonymous"),
                    email: u?.email ?? null,
                    plan: u?.plan ?? null,
                    sessions: r.sessions,
                    daysActive: r.daysActive,
                    pageViews: r.pageViews,
                    totalMinutes: Number((r.activeMs / 60000).toFixed(1)),
                    lastSeen: r.lastSeen,
                };
            }),
        });
    } catch (err) {
        logger.error({ message: "getAnalyticsUsers failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to compute user analytics" } });
    }
}
