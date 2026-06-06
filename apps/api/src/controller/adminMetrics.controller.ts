/**
 * Admin Metrics Controller — §2b of ADMIN_PORTAL_SPEC.md
 *
 * Handlers for every endpoint:
 *   GET /admin/metrics/overview
 *   GET /admin/metrics/users
 *   GET /admin/metrics/users/list
 *   GET /admin/metrics/generations
 *   GET /admin/metrics/generations/list
 *   GET /admin/metrics/content
 *   GET /admin/metrics/revenue
 *   GET /admin/metrics/cost
 */

import { Request, Response } from "express";
import axios from "axios";
import User from "../model/user.model";
import GenerationJob from "../model/generationJob.model";
import Project from "../model/project.model";
import Asset from "../model/asset.model";
import CommunityPost from "../model/communityPost.model";
import SharedVideo from "../model/sharedVideo.model";
import Template from "../model/template.model";
import { TemplateLike } from "../model/templateLike.model";
import ProjectCollaborator from "../model/projectCollaborator.model";
import Feedback from "../model/feedback.model";
import { generationQueue } from "../queue/generationQueue";
import { editQueue } from "../queue/editQueue";
import { MODEL_PRICING } from "../util/pricing";
import logger from "../util/logger.util";

// Map a pipeline stage name → the LLM "role" it represents (for cost-by-role).
const STAGE_ROLE: Record<string, string> = {
    agent_code: "coder",
    agent_debug: "debugger",
    agent_plan: "planner",
    rag_enhance: "query_transform",
    query_transform: "query_transform",
    tts: "tts",
};

function priceFor(model: string, input: number, output: number): { usd: number; known: boolean } {
    const p = MODEL_PRICING[model];
    if (!p) return { usd: 0, known: false };
    return { usd: (input / 1e6) * p.inputPer1M + (output / 1e6) * p.outputPer1M, known: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["queued", "planning", "rendering", "concatenating", "uploading"];

/** Parse ?from / ?to / ?bucket from the request, defaulting to last 30 days, bucket=day. */
function parseRange(req: Request): { from: Date; to: Date; bucket: "day" | "hour" } {
    const now = new Date();
    const to = req.query.to ? new Date(req.query.to as string) : now;
    const from = req.query.from
        ? new Date(req.query.from as string)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const bucket: "day" | "hour" =
        (req.query.bucket as string) === "hour" ? "hour" : "day";
    return { from, to, bucket };
}

function bucketFormat(bucket: "day" | "hour"): string {
    return bucket === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";
}

/** Simple English stopwords for top-prompt-terms. */
const STOPWORDS = new Set([
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "is","it","i","my","me","we","you","your","this","that","these","those",
    "make","create","generate","video","about","show","write","tell","get",
    "be","do","have","from","by","as","into","through","during","include",
    "using","use","add","can","will","just","like","please","want","need",
    "how","what","when","where","who","why","which","there","are","was",
    "were","been","has","had","not","no","up","out","so","if","but","its",
]);

function topTerms(prompts: string[], n = 30): { term: string; count: number }[] {
    const freq: Record<string, number> = {};
    for (const p of prompts) {
        const words = p
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !STOPWORDS.has(w));
        for (const w of words) {
            freq[w] = (freq[w] ?? 0) + 1;
        }
    }
    return Object.entries(freq)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/overview
// ──────────────────────────────────────────────────────────────────────────────
export async function getOverview(_req: Request, res: Response) {
    try {
        const now = new Date();
        const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // User stats
        const [
            totalUsers,
            new24h,
            new7d,
            new30d,
            activeToday,
            activeWeek,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: start24h } }),
            User.countDocuments({ createdAt: { $gte: start7d } }),
            User.countDocuments({ createdAt: { $gte: start30d } }),
            User.countDocuments({ lastActive: { $gte: todayStart } }),
            User.countDocuments({ lastActive: { $gte: start7d } }),
        ]);

        // Revenue stats (unwind payments where status='paid')
        const revenueAgg = await User.aggregate([
            { $unwind: "$payments" },
            { $match: { "payments.status": "paid" } },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$payments.amount" },
                    today: {
                        $sum: {
                            $cond: [
                                { $gte: ["$payments.createdAt", todayStart] },
                                "$payments.amount",
                                0,
                            ],
                        },
                    },
                    mtd: {
                        $sum: {
                            $cond: [
                                {
                                    $gte: [
                                        "$payments.createdAt",
                                        new Date(now.getFullYear(), now.getMonth(), 1),
                                    ],
                                },
                                "$payments.amount",
                                0,
                            ],
                        },
                    },
                },
            },
        ]);
        const rev = revenueAgg[0] ?? { total: 0, today: 0, mtd: 0 };

        // Generation stats
        const [activeGens, last24hJobs] = await Promise.all([
            GenerationJob.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
            GenerationJob.find({ createdAt: { $gte: start24h } })
                .select("status")
                .lean(),
        ]);
        const succeeded24h = last24hJobs.filter((j) => j.status === "complete").length;
        const failed24h = last24hJobs.filter((j) => j.status === "failed").length;
        const total24h = last24hJobs.length;
        // Success rate over TERMINAL jobs only (complete+failed) so in-flight jobs
        // don't artificially depress it. Was succeeded/total (understated under load).
        const terminal24h = succeeded24h + failed24h;
        const successRate24h = terminal24h > 0 ? succeeded24h / terminal24h : 0;

        // Queue counts
        const [genCounts, editCounts] = await Promise.all([
            generationQueue.getJobCounts(),
            editQueue.getJobCounts(),
        ]);

        // Content stats
        const [projectCount, videoAssetCount, postCount, storageAgg] =
            await Promise.all([
                Project.countDocuments(),
                // Real video count = video-type assets (no double-count of compiled
                // projects + their generated_video asset, which are the same video).
                Asset.countDocuments({ type: "video" }),
                CommunityPost.countDocuments(),
                Asset.aggregate([
                    { $group: { _id: null, total: { $sum: "$bytes" } } },
                ]),
            ]);

        const videos = videoAssetCount;
        const storageBytes: number = storageAgg[0]?.total ?? 0;

        // Feedback stats
        const [feedbackNew, feedbackTotal] = await Promise.all([
            Feedback.countDocuments({ status: "new" }),
            Feedback.countDocuments(),
        ]);

        return res.status(200).json({
            users: { total: totalUsers, new24h, new7d, new30d, activeToday, activeWeek },
            revenue: { today: rev.today, mtd: rev.mtd, total: rev.total, currency: "INR" },
            generations: {
                active: activeGens,
                last24h: total24h,
                succeeded24h,
                failed24h,
                successRate24h,
            },
            queue: {
                generation: {
                    active: genCounts.active ?? 0,
                    waiting: genCounts.waiting ?? 0,
                    delayed: genCounts.delayed ?? 0,
                },
                edit: {
                    active: editCounts.active ?? 0,
                    waiting: editCounts.waiting ?? 0,
                    delayed: editCounts.delayed ?? 0,
                },
            },
            content: { projects: projectCount, videos, posts: postCount, storageBytes },
            feedback: { new: feedbackNew, total: feedbackTotal },
        });
    } catch (err) {
        logger.error({ message: "getOverview failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load overview metrics" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/users
// ──────────────────────────────────────────────────────────────────────────────
export async function getUsersMetrics(req: Request, res: Response) {
    try {
        const { from, to, bucket } = parseRange(req);
        const fmt = bucketFormat(bucket);
        const now = new Date();
        const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [
            signupsAgg,
            totalUsers,
            active7d,
            active30d,
            byPlan,
            authSplit,
            credits,
            topUsers,
        ] = await Promise.all([
            // Signups series
            User.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: { $dateToString: { format: fmt, date: "$createdAt" } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: "$_id", count: 1 } },
            ]),
            User.countDocuments(),
            User.countDocuments({ lastActive: { $gte: start7d } }),
            User.countDocuments({ lastActive: { $gte: start30d } }),
            // By plan
            User.aggregate([
                { $group: { _id: "$plan", count: { $sum: 1 } } },
                { $project: { _id: 0, plan: "$_id", count: 1 } },
            ]),
            // Auth split
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        oauth: { $sum: { $cond: [{ $eq: ["$usedOAuth", true] }, 1, 0] } },
                        password: { $sum: { $cond: [{ $ne: ["$usedOAuth", true] }, 1, 0] } },
                    },
                },
            ]),
            // Credits aggregation
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalGeneration: { $sum: "$credits.generation" },
                        totalEditing: { $sum: "$credits.editing" },
                        expiringSoon: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $lte: ["$credits.expiresAt", soonThreshold] },
                                            { $gte: ["$credits.expiresAt", now] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            // Top users by generation count
            GenerationJob.aggregate([
                { $group: { _id: "$userId", generations: { $sum: 1 } } },
                { $sort: { generations: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user",
                    },
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: "$user._id",
                        username: "$user.username",
                        email: "$user.email",
                        plan: "$user.plan",
                        generations: 1,
                        createdAt: "$user.createdAt",
                    },
                },
            ]),
        ]);

        const authData = authSplit[0] ?? { oauth: 0, password: 0 };
        const creditData = credits[0] ?? { totalGeneration: 0, totalEditing: 0, expiringSoon: 0 };

        return res.status(200).json({
            signups: signupsAgg,
            totals: { total: totalUsers, active7d, active30d },
            byPlan,
            authSplit: { oauth: authData.oauth, password: authData.password },
            credits: {
                totalGeneration: creditData.totalGeneration,
                totalEditing: creditData.totalEditing,
                expiringSoon: creditData.expiringSoon,
            },
            topUsers,
        });
    } catch (err) {
        logger.error({ message: "getUsersMetrics failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load user metrics" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/users/list
// ──────────────────────────────────────────────────────────────────────────────
export async function getUsersList(req: Request, res: Response) {
    try {
        const search = (req.query.search as string) || "";
        const plan = (req.query.plan as string) || "";
        const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        if (plan) {
            filter.plan = plan;
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("username email plan role isActive isTestAccount credits createdAt lastActive")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        const userRows = users.map((u) => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            plan: u.plan,
            role: u.role,
            isActive: u.isActive,
            isTestAccount: u.isTestAccount,
            credits: {
                generation: u.credits?.generation ?? 0,
                editing: u.credits?.editing ?? 0,
            },
            createdAt: u.createdAt,
            lastActive: u.lastActive,
        }));

        return res.status(200).json({ users: userRows, total, page, limit });
    } catch (err) {
        logger.error({ message: "getUsersList failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load user list" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/generations
// ──────────────────────────────────────────────────────────────────────────────
export async function getGenerationsMetrics(req: Request, res: Response) {
    try {
        const { from, to, bucket } = parseRange(req);
        const fmt = bucketFormat(bucket);

        const [seriesAgg, statusBreakdown, jobs, recentJobs] = await Promise.all([
            // Series per bucket
            GenerationJob.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: { $dateToString: { format: fmt, date: "$createdAt" } },
                        complete: { $sum: { $cond: [{ $eq: ["$status", "complete"] }, 1, 0] } },
                        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                        total: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: "$_id", complete: 1, failed: 1, cancelled: 1, total: 1 } },
            ]),
            // Status breakdown
            GenerationJob.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $project: { _id: 0, status: "$_id", count: 1 } },
            ]),
            // All jobs in range for JS-side percentile + terms computation
            GenerationJob.find({ createdAt: { $gte: from, $lte: to } })
                .select("status queue prompt error sceneProgress startedAt completedAt debugInvoked debugResolved usedFallbackLlm usedFallbackScene")
                .lean(),
            // Recent prompts
            GenerationJob.find({ createdAt: { $gte: from, $lte: to } })
                .sort({ createdAt: -1 })
                .limit(20)
                .select("prompt status createdAt userId")
                .lean(),
        ]);

        // Totals
        const total = jobs.length;
        const completeCount = jobs.filter((j) => j.status === "complete").length;
        const failedCount = jobs.filter((j) => j.status === "failed").length;
        // Rates over TERMINAL jobs (complete+failed) so in-flight jobs don't skew them.
        const terminalCount = completeCount + failedCount;
        const successRate = terminalCount > 0 ? completeCount / terminalCount : 0;
        const failureRate = terminalCount > 0 ? failedCount / terminalCount : 0;
        // Resilience rates (real animation vs fallback title-card, fallback-LLM saves).
        const realCount = jobs.filter((j) => j.status === "complete" && !(j as Record<string, unknown>).usedFallbackScene).length;
        const fallbackSceneCount = jobs.filter((j) => (j as Record<string, unknown>).usedFallbackScene).length;
        const fallbackLlmCount = jobs.filter((j) => (j as Record<string, unknown>).usedFallbackLlm).length;
        const realRate = completeCount > 0 ? realCount / completeCount : 0;

        // Duration percentiles (only jobs that have both startedAt and completedAt)
        const durations: number[] = jobs
            .filter((j) => j.completedAt && j.startedAt)
            .map((j) => new Date(j.completedAt!).getTime() - new Date(j.startedAt).getTime())
            .sort((a, b) => a - b);

        const p50Ms = percentile(durations, 50);
        const p95Ms = percentile(durations, 95);
        const avgMs = durations.length > 0
            ? durations.reduce((s, v) => s + v, 0) / durations.length
            : 0;

        // Retry rate = fraction of jobs that needed the debug loop (the real
        // "retry" in this pipeline). attemptsMade was never persisted → always 0.
        const debugInvokedCount = jobs.filter((j) => (j as Record<string, unknown>).debugInvoked).length;
        const debugResolvedCount = jobs.filter((j) => (j as Record<string, unknown>).debugResolved).length;
        const retried = debugInvokedCount;
        const retryRate = total > 0 ? retried / total : 0;

        // Avg scenes
        const totalScenes = jobs.reduce((s, j) => s + (j.sceneProgress?.total ?? 0), 0);
        const avgScenes = total > 0 ? totalScenes / total : 0;

        // Failure reasons
        const reasonFreq: Record<string, number> = {};
        for (const j of jobs) {
            if (j.status === "failed" && j.error) {
                const key = j.error.slice(0, 100);
                reasonFreq[key] = (reasonFreq[key] ?? 0) + 1;
            }
        }
        const failureReasons = Object.entries(reasonFreq)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Queue split
        const genJobs = jobs.filter((j) => j.queue === "generation").length;
        const editJobs = jobs.filter((j) => j.queue === "edit").length;

        // Top prompt terms
        const prompts = jobs.map((j) => j.prompt ?? "");
        const topPromptTerms = topTerms(prompts);

        return res.status(200).json({
            series: seriesAgg,
            statusBreakdown,
            successRate,
            failureRate,
            duration: { p50Ms, p95Ms, avgMs },
            retryRate,
            avgScenes,
            // Resilience visibility (real animation vs guaranteed title-card; how
            // often the LLM fallback or debug loop saved a generation).
            realRate,
            realCount,
            fallbackSceneCount,
            fallbackLlmCount,
            debugInvokedRate: total > 0 ? debugInvokedCount / total : 0,
            debugResolveRate: debugInvokedCount > 0 ? debugResolvedCount / debugInvokedCount : 0,
            failureReasons,
            queueSplit: { generation: genJobs, edit: editJobs },
            recentPrompts: recentJobs.map((j) => ({
                prompt: j.prompt,
                status: j.status,
                createdAt: j.createdAt,
                userId: j.userId,
            })),
            topPromptTerms,
        });
    } catch (err) {
        logger.error({ message: "getGenerationsMetrics failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load generation metrics" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/generations/list
// ──────────────────────────────────────────────────────────────────────────────
export async function getGenerationsList(req: Request, res: Response) {
    try {
        const status = (req.query.status as string) || "";
        const queue = (req.query.queue as string) || "";
        const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (queue) filter.queue = queue;

        const [jobs, total] = await Promise.all([
            GenerationJob.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("jobId queue userId prompt status sceneProgress error startedAt completedAt traceId finalUrl rating ratedAt curationStatus debugInvoked debugResolved")
                .lean(),
            GenerationJob.countDocuments(filter),
        ]);

        const jobRows = jobs.map((j) => {
            const jr = j as typeof j & {
                rating?: number | null;
                ratedAt?: Date;
                curationStatus?: string;
                debugInvoked?: boolean;
                debugResolved?: boolean;
            };
            return {
                _id: jr._id,
                jobId: jr.jobId,
                queue: jr.queue,
                userId: jr.userId,
                prompt: jr.prompt,
                status: jr.status,
                sceneProgress: jr.sceneProgress,
                error: jr.error,
                startedAt: jr.startedAt,
                completedAt: jr.completedAt,
                durationMs:
                    jr.completedAt && jr.startedAt
                        ? new Date(jr.completedAt).getTime() - new Date(jr.startedAt).getTime()
                        : undefined,
                traceId: jr.traceId,
                finalUrl: jr.finalUrl,
                rating: jr.rating ?? null,
                ratedAt: jr.ratedAt,
                curationStatus: jr.curationStatus ?? "unreviewed",
                debugInvoked: jr.debugInvoked ?? false,
                debugResolved: jr.debugResolved ?? false,
            };
        });

        return res.status(200).json({ jobs: jobRows, total, page, limit });
    } catch (err) {
        logger.error({ message: "getGenerationsList failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load generation list" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/generations/:jobId
// ──────────────────────────────────────────────────────────────────────────────
export async function getGenerationDetail(req: Request, res: Response) {
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({ error: { message: "jobId is required" } });
        }

        // Support lookup by BullMQ jobId (string) OR MongoDB _id
        const job = await GenerationJob.findOne({ jobId }).lean();
        if (!job) {
            // Fallback: try by MongoDB _id (useful when clicking from the list)
            const { Types: MongooseTypes } = await import("mongoose");
            if (!MongooseTypes.ObjectId.isValid(jobId)) {
                return res.status(404).json({ error: { message: "Job not found" } });
            }
            const byOid = await GenerationJob.findById(jobId).lean();
            if (!byOid) {
                return res.status(404).json({ error: { message: "Job not found" } });
            }
            return res.status(200).json(byOid);
        }

        return res.status(200).json(job);
    } catch (err) {
        logger.error({ message: "getGenerationDetail failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load generation detail" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/content
// ──────────────────────────────────────────────────────────────────────────────
export async function getContentMetrics(req: Request, res: Response) {
    try {
        const { from, to } = parseRange(req);

        const [
            projectTotal,
            projectByStatus,
            projectSeries,
            assetTotal,
            assetByType,
            assetByOrigin,
            assetStorage,
            postCount,
            communityAgg,
            topPosts,
            shareAgg,
            templateTotal,
            topLiked,
            collabInvites,
            collabAccepted,
        ] = await Promise.all([
            Project.countDocuments(),
            Project.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $project: { _id: 0, status: "$_id", count: 1 } },
            ]),
            Project.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: "$_id", count: 1 } },
            ]),
            Asset.countDocuments(),
            Asset.aggregate([
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $project: { _id: 0, type: "$_id", count: 1 } },
            ]),
            Asset.aggregate([
                { $group: { _id: "$origin", count: { $sum: 1 } } },
                { $project: { _id: 0, origin: "$_id", count: 1 } },
            ]),
            Asset.aggregate([
                { $group: { _id: null, storageBytes: { $sum: "$bytes" } } },
            ]),
            CommunityPost.countDocuments(),
            // Community aggregate: likes, comments, views
            CommunityPost.aggregate([
                {
                    $group: {
                        _id: null,
                        likes: { $sum: "$likesCount" },
                        comments: { $sum: "$commentsCount" },
                        views: { $sum: "$analytics.views" },
                    },
                },
            ]),
            // Top posts
            CommunityPost.aggregate([
                { $sort: { likesCount: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "users",
                        localField: "authorId",
                        foreignField: "_id",
                        as: "authorData",
                    },
                },
                { $unwind: { path: "$authorData", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        author: "$authorData.username",
                        likesCount: 1,
                        views: "$analytics.views",
                    },
                },
            ]),
            // Share stats
            SharedVideo.aggregate([
                { $group: { _id: null, total: { $sum: 1 }, totalViews: { $sum: "$views" } } },
            ]),
            Template.countDocuments(),
            // Top liked templates
            TemplateLike.aggregate([
                { $group: { _id: "$templateId", likes: { $sum: 1 } } },
                { $sort: { likes: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "templates",
                        localField: "_id",
                        foreignField: "_id",
                        as: "template",
                    },
                },
                { $unwind: { path: "$template", preserveNullAndEmptyArrays: true } },
                { $project: { _id: "$template._id", title: "$template.title", likes: 1 } },
            ]),
            ProjectCollaborator.countDocuments(),
            ProjectCollaborator.countDocuments({ status: "accepted" }),
        ]);

        const commData = communityAgg[0] ?? { likes: 0, comments: 0, views: 0 };
        const shareData = shareAgg[0] ?? { total: 0, totalViews: 0 };
        const storageBytesAsset: number = assetStorage[0]?.storageBytes ?? 0;
        const acceptanceRate =
            collabInvites > 0 ? collabAccepted / collabInvites : 0;

        return res.status(200).json({
            projects: {
                total: projectTotal,
                byStatus: projectByStatus,
                createdSeries: projectSeries,
            },
            assets: {
                total: assetTotal,
                byType: assetByType,
                byOrigin: assetByOrigin,
                storageBytes: storageBytesAsset,
            },
            community: {
                posts: postCount,
                likes: commData.likes,
                comments: commData.comments,
                views: commData.views,
                topPosts,
            },
            shares: { total: shareData.total, totalViews: shareData.totalViews },
            templates: { total: templateTotal, topLiked },
            collab: { invites: collabInvites, accepted: collabAccepted, acceptanceRate },
        });
    } catch (err) {
        logger.error({ message: "getContentMetrics failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load content metrics" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/revenue
// ──────────────────────────────────────────────────────────────────────────────
export async function getRevenueMetrics(req: Request, res: Response) {
    try {
        const { from, to, bucket } = parseRange(req);
        const fmt = bucketFormat(bucket);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [seriesAgg, byPlanAgg, statusBreakdownAgg, totalsAgg, recentAgg] =
            await Promise.all([
                // Series (only paid)
                User.aggregate([
                    { $unwind: "$payments" },
                    {
                        $match: {
                            "payments.status": "paid",
                            "payments.createdAt": { $gte: from, $lte: to },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: fmt, date: "$payments.createdAt" },
                            },
                            amount: { $sum: "$payments.amount" },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                    { $project: { _id: 0, date: "$_id", amount: 1, count: 1 } },
                ]),
                // By plan
                User.aggregate([
                    { $unwind: "$payments" },
                    {
                        $match: {
                            "payments.status": "paid",
                            "payments.createdAt": { $gte: from, $lte: to },
                        },
                    },
                    {
                        $group: {
                            _id: "$payments.plan",
                            amount: { $sum: "$payments.amount" },
                            count: { $sum: 1 },
                        },
                    },
                    { $project: { _id: 0, plan: "$_id", amount: 1, count: 1 } },
                ]),
                // Status breakdown (all statuses)
                User.aggregate([
                    { $unwind: "$payments" },
                    {
                        $match: {
                            "payments.createdAt": { $gte: from, $lte: to },
                        },
                    },
                    { $group: { _id: "$payments.status", count: { $sum: 1 } } },
                    { $project: { _id: 0, status: "$_id", count: 1 } },
                ]),
                // Totals
                User.aggregate([
                    { $unwind: "$payments" },
                    { $match: { "payments.status": "paid" } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$payments.amount" },
                            today: {
                                $sum: {
                                    $cond: [
                                        { $gte: ["$payments.createdAt", todayStart] },
                                        "$payments.amount",
                                        0,
                                    ],
                                },
                            },
                            mtd: {
                                $sum: {
                                    $cond: [
                                        { $gte: ["$payments.createdAt", mtdStart] },
                                        "$payments.amount",
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ]),
                // Recent payments (last 20)
                User.aggregate([
                    { $unwind: "$payments" },
                    { $sort: { "payments.createdAt": -1 } },
                    { $limit: 20 },
                    {
                        $project: {
                            _id: 0,
                            user: { username: "$username", email: "$email" },
                            plan: "$payments.plan",
                            amount: "$payments.amount",
                            status: "$payments.status",
                            createdAt: "$payments.createdAt",
                        },
                    },
                ]),
            ]);

        const totData = totalsAgg[0] ?? { total: 0, today: 0, mtd: 0 };

        return res.status(200).json({
            series: seriesAgg,
            totals: { today: totData.today, mtd: totData.mtd, total: totData.total, currency: "INR" },
            byPlan: byPlanAgg,
            statusBreakdown: statusBreakdownAgg,
            recent: recentAgg,
        });
    } catch (err) {
        logger.error({ message: "getRevenueMetrics failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load revenue metrics" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/metrics/cost
// ──────────────────────────────────────────────────────────────────────────────

const PROMETHEUS_URL =
    process.env.PROMETHEUS_URL ?? "http://localhost:9090";

/** Zero-value cost shape returned when no data source is available. */
function emptyCostShape(source: "none" | "prometheus" | "persisted", note?: string) {
    return {
        tokens: { input: 0, output: 0, total: 0, byModel: [], byRole: [] },
        series: [],
        cost: { totalUsd: 0, perJobAvgUsd: 0, byModel: [] },
        source,
        ...(note ? { note } : {}),
    };
}

export async function getCostMetrics(req: Request, res: Response) {
    try {
        const { from, to } = parseRange(req);

        // ── 1. Try Prometheus ────────────────────────────────────────────────
        try {
            const promEnd = Math.floor(to.getTime() / 1000);
            const promStart = Math.floor(from.getTime() / 1000);
            const step = Math.max(3600, Math.floor((promEnd - promStart) / 100));

            const [rangeRes, inputRes, outputRes] = await Promise.all([
                axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
                    params: {
                        query: 'sum by (model) (increase(stitcher_llm_tokens_total[1d]))',
                        start: promStart,
                        end: promEnd,
                        step,
                    },
                    timeout: 4000,
                }),
                axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
                    params: {
                        query: 'sum(stitcher_llm_tokens_total{token_type="input"})',
                        time: promEnd,
                    },
                    timeout: 4000,
                }),
                axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
                    params: {
                        query: 'sum(stitcher_llm_tokens_total{token_type="output"})',
                        time: promEnd,
                    },
                    timeout: 4000,
                }),
            ]);

            // Check if Prometheus returned actual data
            const inputVal = Number(inputRes.data?.data?.result?.[0]?.value?.[1] ?? 0);
            const outputVal = Number(outputRes.data?.data?.result?.[0]?.value?.[1] ?? 0);

            if (inputVal === 0 && outputVal === 0) {
                // Prometheus reachable but no data — fall through to persisted
                throw new Error("prometheus_empty");
            }

            // Parse range data into series
            const seriesMap: Record<string, { input: number; output: number }> = {};
            const rangeResults: Array<{
                metric: Record<string, string>;
                values: [number, string][];
            }> = rangeRes.data?.data?.result ?? [];
            for (const r of rangeResults) {
                for (const [ts, val] of r.values) {
                    const date = new Date(ts * 1000).toISOString().slice(0, 10);
                    if (!seriesMap[date]) seriesMap[date] = { input: 0, output: 0 };
                    const tokenType = r.metric.token_type;
                    const n = Number(val);
                    if (tokenType === "input") seriesMap[date].input += n;
                    else seriesMap[date].output += n;
                }
            }
            const series = Object.entries(seriesMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, v]) => ({ date, input: v.input, output: v.output }));

            // byModel from range results
            const byModelMap: Record<string, { input: number; output: number }> = {};
            for (const r of rangeResults) {
                const m = r.metric.model ?? "unknown";
                if (!byModelMap[m]) byModelMap[m] = { input: 0, output: 0 };
                const sum = r.values.reduce((s, [, v]) => s + Number(v), 0);
                const tokenType = r.metric.token_type;
                if (tokenType === "input") byModelMap[m].input += sum;
                else byModelMap[m].output += sum;
            }
            const byModel = Object.entries(byModelMap).map(([model, v]) => ({
                model,
                input: v.input,
                output: v.output,
            }));

            return res.status(200).json({
                tokens: {
                    input: inputVal,
                    output: outputVal,
                    total: inputVal + outputVal,
                    byModel,
                    byRole: [],
                },
                series,
                cost: { totalUsd: 0, perJobAvgUsd: 0, byModel: [] },
                source: "prometheus" as const,
            });
        } catch (promErr) {
            // Prometheus unreachable or empty — fall through
            const msg = String(promErr);
            if (!msg.includes("prometheus_empty")) {
                logger.error({ message: "Prometheus unreachable for cost metrics", error: msg });
            }
        }

        // ── 2. Fall back to persisted GenerationJob tokens/costUsd ──────────
        try {
            const jobs = await GenerationJob.find({
                createdAt: { $gte: from, $lte: to },
            })
                .select("tokens costUsd createdAt stages")
                .lean<Array<{
                    tokens?: { input?: number; output?: number };
                    costUsd?: number;
                    createdAt: Date;
                    stages?: Array<{ stage: string; model?: string; tokens?: { input?: number; output?: number } }>;
                }>>();

            const jobsWithData = jobs.filter(
                (j) => j.tokens !== undefined || j.costUsd !== undefined || (j.stages?.length ?? 0) > 0
            );

            if (jobsWithData.length === 0) {
                return res.status(200).json(
                    emptyCostShape("none", "No generation jobs with token usage in this range yet.")
                );
            }

            let totalInput = 0;
            let totalOutput = 0;
            let totalCostUsd = 0;
            const seriesMap: Record<string, { input: number; output: number }> = {};
            // Per-model + per-role token accumulation from stages[] (the source of
            // truth the old code ignored). Cost recomputed from the pricing table so
            // a single unmapped model no longer zeroes the whole job's cost.
            const modelAgg = new Map<string, { input: number; output: number }>();
            const roleAgg = new Map<string, number>();
            const unknownModels = new Set<string>();

            for (const j of jobsWithData) {
                const inp = j.tokens?.input ?? 0;
                const out = j.tokens?.output ?? 0;
                totalInput += inp;
                totalOutput += out;

                const date = new Date(j.createdAt).toISOString().slice(0, 10);
                if (!seriesMap[date]) seriesMap[date] = { input: 0, output: 0 };
                seriesMap[date].input += inp;
                seriesMap[date].output += out;

                let jobCost = 0;
                for (const s of j.stages ?? []) {
                    if (!s.model || !s.tokens) continue;
                    const si = s.tokens.input ?? 0;
                    const so = s.tokens.output ?? 0;
                    const m = modelAgg.get(s.model) ?? { input: 0, output: 0 };
                    m.input += si; m.output += so;
                    modelAgg.set(s.model, m);

                    const role = STAGE_ROLE[s.stage] ?? s.stage;
                    roleAgg.set(role, (roleAgg.get(role) ?? 0) + si + so);

                    const pr = priceFor(s.model, si, so);
                    if (!pr.known) unknownModels.add(s.model);
                    jobCost += pr.usd;
                }
                // Prefer the worker's persisted costUsd; fall back to our stage-sum
                // (which is non-zero even when the worker stored null).
                totalCostUsd += (typeof j.costUsd === "number" && j.costUsd > 0) ? j.costUsd : jobCost;
            }

            const series = Object.entries(seriesMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, v]) => ({ date, input: v.input, output: v.output }));

            const byModel = Array.from(modelAgg.entries())
                .map(([model, v]) => ({ model, input: v.input, output: v.output }))
                .sort((a, b) => (b.input + b.output) - (a.input + a.output));
            const costByModel = Array.from(modelAgg.entries())
                .map(([model, v]) => ({ model, usd: Number(priceFor(model, v.input, v.output).usd.toFixed(6)) }))
                .sort((a, b) => b.usd - a.usd);
            const byRole = Array.from(roleAgg.entries())
                .map(([role, tokens]) => ({ role, tokens }))
                .sort((a, b) => b.tokens - a.tokens);

            const perJobAvgUsd = jobsWithData.length > 0 ? totalCostUsd / jobsWithData.length : 0;

            return res.status(200).json({
                tokens: {
                    input: totalInput,
                    output: totalOutput,
                    total: totalInput + totalOutput,
                    byModel,
                    byRole,
                },
                series,
                cost: { totalUsd: Number(totalCostUsd.toFixed(6)), perJobAvgUsd: Number(perJobAvgUsd.toFixed(6)), byModel: costByModel },
                source: "persisted" as const,
                ...(unknownModels.size > 0 ? { unknownModels: Array.from(unknownModels) } : {}),
            });
        } catch (dbErr) {
            logger.error({ message: "getCostMetrics persisted fallback failed", error: String(dbErr) });
            return res.status(200).json(
                emptyCostShape(
                    "none",
                    "Agent service not yet emitting token metrics; see ADMIN_PORTAL_SPEC §5."
                )
            );
        }
    } catch (err) {
        logger.error({ message: "getCostMetrics failed", error: String(err) });
        // Never 500 the dashboard on cost metrics
        return res.status(200).json(
            emptyCostShape(
                "none",
                "Agent service not yet emitting token metrics; see ADMIN_PORTAL_SPEC §5."
            )
        );
    }
}
