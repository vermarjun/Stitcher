/**
 * Admin pipeline metrics — the operational "is the generation engine healthy?"
 * view, computed from GenerationJob.stages[] (which no other endpoint reads).
 *
 * GET /admin/metrics/pipeline?from&to
 *   {
 *     range: { from, to },
 *     totals: { jobs, complete, failed, cancelled, real, fallbackScene, fallbackLlm },
 *     rates:  { real, fallbackScene, fallbackLlm, debugInvoked, debugResolved, success },
 *     stages: [{ stage, runs, okRate, failRate, p50Ms, p95Ms, avgMs, errors }],
 *     failureCategories: [{ category, count }],
 *     byModel:    [{ model, calls, inputTokens, outputTokens, totalTokens, costUsd, unknownPrice }],
 *     byProvider: [{ provider, calls, inputTokens, outputTokens, totalTokens }],
 *     slowestStages: [{ stage, p95Ms }],
 *   }
 *
 * Everything here is derived from data the worker already persists — it turns the
 * dormant stages[] + usedFallback* + debug flags into the founder's launch-day
 * dashboard for "what's slow / what's failing / how often the fallback saved us".
 */

import { Request, Response } from "express";
import GenerationJob from "../model/generationJob.model";
import GenerationLlmIO from "../model/generationLlmIO.model";
import { MODEL_PRICING } from "../util/pricing";
import logger from "../util/logger.util";

function parseRange(req: Request): { from: Date; to: Date } {
    const now = Date.now();
    const toRaw = Date.parse(String(req.query.to ?? ""));
    const fromRaw = Date.parse(String(req.query.from ?? ""));
    const to = Number.isFinite(toRaw) ? new Date(toRaw) : new Date(now);
    const from = Number.isFinite(fromRaw) ? new Date(fromRaw) : new Date(now - 7 * 24 * 3600_000);
    return { from, to };
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx]!;
}

function costFor(model: string, inputTok: number, outputTok: number): { usd: number; known: boolean } {
    const price = MODEL_PRICING[model];
    if (!price) return { usd: 0, known: false };
    return {
        usd: (inputTok / 1_000_000) * price.inputPer1M + (outputTok / 1_000_000) * price.outputPer1M,
        known: true,
    };
}

export async function getPipelineMetrics(req: Request, res: Response): Promise<Response> {
    const { from, to } = parseRange(req);
    try {
        const jobs = await GenerationJob.find({ createdAt: { $gte: from, $lte: to } })
            .select("status stages debugInvoked debugResolved usedFallbackLlm usedFallbackScene finalCode createdAt")
            .lean<Array<{
                status: string;
                stages?: Array<{ stage: string; status: string; durationMs?: number; model?: string; outputSummary?: string; tokens?: { input?: number; output?: number } }>;
                debugInvoked?: boolean;
                debugResolved?: boolean;
                usedFallbackLlm?: boolean;
                usedFallbackScene?: boolean;
                finalCode?: string;
            }>>();

        const totals = { jobs: jobs.length, complete: 0, failed: 0, cancelled: 0, real: 0, fallbackScene: 0, fallbackLlm: 0 };
        let debugInvokedN = 0, debugResolvedN = 0;

        // Per-stage latency accumulators
        const stageAgg = new Map<string, { runs: number; ok: number; fail: number; durations: number[]; errors: number }>();
        const failureCategories = new Map<string, number>();
        const modelAgg = new Map<string, { calls: number; input: number; output: number }>();

        for (const j of jobs) {
            if (j.status === "complete") totals.complete++;
            else if (j.status === "failed") totals.failed++;
            else if (j.status === "cancelled") totals.cancelled++;

            // real vs fallback. Prefer persisted flags; fall back to finalCode sniff
            // for jobs created before the flags existed.
            const isFallbackScene = j.usedFallbackScene ?? (j.finalCode?.includes("FallbackScene") ?? false);
            if (j.usedFallbackLlm) totals.fallbackLlm++;
            if (j.status === "complete") {
                if (isFallbackScene) totals.fallbackScene++;
                else totals.real++;
            }

            if (j.debugInvoked) debugInvokedN++;
            if (j.debugResolved) debugResolvedN++;

            for (const s of j.stages ?? []) {
                const a = stageAgg.get(s.stage) ?? { runs: 0, ok: 0, fail: 0, durations: [], errors: 0 };
                a.runs++;
                if (s.status === "ok") a.ok++;
                else { a.fail++; a.errors++; }
                if (typeof s.durationMs === "number" && s.durationMs >= 0) a.durations.push(s.durationMs);
                stageAgg.set(s.stage, a);

                // render failure category from outputSummary "…cat=<category>"
                if (s.stage === "render" && s.status === "failed" && s.outputSummary) {
                    const m = s.outputSummary.match(/cat=([\w-]+)/);
                    const cat = m?.[1] ?? "unknown";
                    failureCategories.set(cat, (failureCategories.get(cat) ?? 0) + 1);
                }

                // per-model tokens (agent_code / agent_debug carry model + tokens)
                if (s.model && s.tokens) {
                    const mm = modelAgg.get(s.model) ?? { calls: 0, input: 0, output: 0 };
                    mm.calls++;
                    mm.input += s.tokens.input ?? 0;
                    mm.output += s.tokens.output ?? 0;
                    modelAgg.set(s.model, mm);
                }
            }
        }

        const stages = Array.from(stageAgg.entries()).map(([stage, a]) => {
            const sorted = a.durations.slice().sort((x, y) => x - y);
            const avg = sorted.length ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
            return {
                stage,
                runs: a.runs,
                okRate: a.runs ? a.ok / a.runs : 0,
                failRate: a.runs ? a.fail / a.runs : 0,
                p50Ms: percentile(sorted, 50),
                p95Ms: percentile(sorted, 95),
                avgMs: avg,
                errors: a.errors,
            };
        }).sort((x, y) => y.p95Ms - x.p95Ms);

        const byModel = Array.from(modelAgg.entries()).map(([model, m]) => {
            const c = costFor(model, m.input, m.output);
            return {
                model,
                calls: m.calls,
                inputTokens: m.input,
                outputTokens: m.output,
                totalTokens: m.input + m.output,
                costUsd: Number(c.usd.toFixed(6)),
                unknownPrice: !c.known,
            };
        }).sort((x, y) => y.totalTokens - x.totalTokens);

        // Per-provider from the richer GenerationLlmIO log (provider + tokensUsed)
        const providerRows = await GenerationLlmIO.aggregate([
            { $match: { createdAt: { $gte: from, $lte: to } } },
            { $group: {
                _id: "$provider",
                calls: { $sum: 1 },
                input: { $sum: { $ifNull: ["$tokensUsed.input", 0] } },
                output: { $sum: { $ifNull: ["$tokensUsed.output", 0] } },
            } },
            { $sort: { input: -1 } },
        ]);
        const byProvider = providerRows.map((r) => ({
            provider: r._id ?? "unknown",
            calls: r.calls,
            inputTokens: r.input,
            outputTokens: r.output,
            totalTokens: r.input + r.output,
        }));

        const terminal = totals.complete + totals.failed; // exclude in-flight/cancelled
        return res.status(200).json({
            range: { from: from.toISOString(), to: to.toISOString() },
            totals,
            rates: {
                // success = produced a video (complete) over terminal jobs
                success: terminal ? totals.complete / terminal : 0,
                // real animation rate = real / complete (how often it's NOT a title-card)
                real: totals.complete ? totals.real / totals.complete : 0,
                fallbackScene: totals.complete ? totals.fallbackScene / totals.complete : 0,
                fallbackLlm: totals.jobs ? totals.fallbackLlm / totals.jobs : 0,
                debugInvoked: totals.jobs ? debugInvokedN / totals.jobs : 0,
                // resolve rate = of jobs that invoked debug, how many ended real+complete
                debugResolved: debugInvokedN ? debugResolvedN / debugInvokedN : 0,
            },
            stages,
            failureCategories: Array.from(failureCategories.entries())
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count),
            byModel,
            byProvider,
            slowestStages: stages.slice(0, 3).map((s) => ({ stage: s.stage, p95Ms: s.p95Ms })),
        });
    } catch (err) {
        logger.error({ message: "getPipelineMetrics failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to compute pipeline metrics" } });
    }
}
