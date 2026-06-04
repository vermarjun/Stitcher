/**
 * Admin RLHF Controller — RLHF + LLM I/O + Coder Memory admin endpoints.
 *
 * Endpoints:
 *   POST /admin/generations/:jobId/curate    — approve or reject a job for RAG
 *   POST /admin/rag/sync                     — sync pending RagCandidates to RAG
 *   GET  /admin/generations/:jobId/llm-io   — full LLM I/O log for a job
 *   GET  /admin/rlhf/lessons                — list all CoderLessons newest-first
 *   POST /admin/rlhf/lessons                — create a manual lesson
 *   PATCH /admin/rlhf/lessons/:id           — edit a lesson's text
 *   DELETE /admin/rlhf/lessons/:id          — delete a lesson
 */

import { Request, Response } from "express";
import { Types } from "mongoose";
import GenerationJob from "../model/generationJob.model";
import RagCandidate from "../model/ragCandidate.model";
import GenerationLlmIO from "../model/generationLlmIO.model";
import AdminAuditLog from "../model/adminAuditLog.model";
import Asset from "../model/asset.model";
import CoderLesson from "../model/coderLesson.model";
import { ragClient } from "../services/ragClient";
import logger from "../util/logger.util";

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/generations/:jobId/curate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Approve or reject a GenerationJob for the RAG pipeline.
 *
 * Body: { decision: "approve" | "reject" }
 *
 * On approve: sets curationStatus="approved" and upserts a RagCandidate
 * (status "pending") built from the job's prompt, finalCode, sceneClass, and
 * rating. A subsequent call to /rag/sync will embed this candidate.
 *
 * On reject: sets curationStatus="rejected" only — no candidate is created.
 *
 * Writes an AdminAuditLog entry.
 */
export async function curateGeneration(req: Request, res: Response) {
    const { jobId } = req.params;
    const { decision } = req.body as { decision?: string };
    const adminId = req.userId;

    if (!jobId) {
        return res.status(400).json({ error: { message: "jobId is required" } });
    }
    if (decision !== "approve" && decision !== "reject") {
        return res.status(400).json({ error: { message: "decision must be 'approve' or 'reject'" } });
    }

    try {
        // Find job by BullMQ jobId string or MongoDB _id
        const job = await GenerationJob.findOne(
            Types.ObjectId.isValid(jobId)
                ? { $or: [{ jobId }, { _id: new Types.ObjectId(jobId) }] }
                : { jobId }
        ).lean();

        if (!job) {
            return res.status(404).json({ error: { message: "Job not found" } });
        }

        const mongoId = (job._id as Types.ObjectId).toString();

        // Update curation status on the job
        await GenerationJob.updateOne(
            { _id: job._id },
            { $set: { curationStatus: decision === "approve" ? "approved" : "rejected" } }
        );

        if (decision === "approve") {
            // Extract the code from the job. Prefer finalCode (persisted by worker);
            // fall back to searching the last agent_code llmCallLog rawOutput.
            let code = (job as Record<string, unknown>).finalCode as string | undefined;

            if (!code) {
                // Try to extract from the last agent_code LlmIO rawOutput
                const ioEntry = await GenerationLlmIO.findOne({
                    jobId: job.jobId,
                    stage: "agent_code",
                })
                    .sort({ createdAt: -1 })
                    .select("rawOutput")
                    .lean();
                if (ioEntry?.rawOutput) {
                    code = ioEntry.rawOutput;
                }
            }
            if (!code) {
                code = "";
            }

            // Resolve sceneClass: try the most recent Asset for this chatId
            let sceneClass = "UnknownScene";
            if (job.chatId) {
                const asset = await Asset.findOne({ scene_description: { $exists: true } })
                    .sort({ createdAt: -1 })
                    .select("scene_name")
                    .lean();
                // More precise: find by chatId embedded in asset name convention or metadata
                const assetByChatId = await Asset.findOne({
                    "metadata.chatId": job.chatId?.toString(),
                })
                    .sort({ createdAt: -1 })
                    .select("scene_name")
                    .lean();
                if (assetByChatId?.scene_name) sceneClass = assetByChatId.scene_name;
                else if (asset?.scene_name) sceneClass = asset.scene_name;
            }

            const jobRecord = job as Record<string, unknown>;

            // Upsert RagCandidate (idempotent on repeated approvals)
            await RagCandidate.findOneAndUpdate(
                { jobId: job._id as Types.ObjectId },
                {
                    $setOnInsert: {
                        jobId: job._id as Types.ObjectId,
                        chatId: job.chatId,
                        userId: job.userId,
                        createdAt: new Date(),
                    },
                    $set: {
                        prompt: job.prompt,
                        code,
                        sceneClass,
                        apisUsed: Array.isArray(jobRecord.apisUsed) ? jobRecord.apisUsed as string[] : undefined,
                        rating: typeof jobRecord.rating === "number" ? jobRecord.rating as number : undefined,
                        status: "pending",
                    },
                },
                { upsert: true, new: true }
            );
        }

        // Audit log
        try {
            await AdminAuditLog.create({
                adminId: new Types.ObjectId(adminId!),
                action: `curate_generation_${decision}`,
                targetType: "generation_job",
                targetId: mongoId,
                payload: { decision, jobId: job.jobId },
            });
        } catch { /* audit log failure is non-fatal */ }

        return res.status(200).json({ ok: true, jobId: job.jobId, curationStatus: decision === "approve" ? "approved" : "rejected" });
    } catch (err) {
        logger.error({ message: "curateGeneration failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to curate generation" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/rag/sync
// ──────────────────────────────────────────────────────────────────────────────

/**
 * For each RagCandidate with status "pending", POST to RAG /corpus/add
 * (embed into the live corpus), then mark status "synced" + syncedAt.
 *
 * Returns { synced: number, failed: number }.
 */
export async function syncRagCandidates(_req: Request, res: Response) {
    try {
        const pending = await RagCandidate.find({ status: "pending" }).lean();

        if (pending.length === 0) {
            return res.status(200).json({ synced: 0, failed: 0, message: "No pending candidates" });
        }

        let synced = 0;
        let failed = 0;

        for (const candidate of pending) {
            try {
                // Build corpus document: code + prompt as content + curated source
                const corpusDoc = {
                    content: candidate.prompt,
                    code: candidate.code,
                    title: (candidate.prompt ?? "").slice(0, 120),
                    source: "curated",
                    docType: "script" as const,
                    apisUsed: candidate.apisUsed ?? [],
                    quality: candidate.rating ?? 4,
                };
                await ragClient.corpusAdd({ documents: [corpusDoc] });
                await RagCandidate.updateOne(
                    { _id: candidate._id },
                    { $set: { status: "synced", syncedAt: new Date() } }
                );
                synced++;
            } catch (syncErr) {
                failed++;
                logger.warn({
                    message: "[admin] RAG sync failed for candidate",
                    candidateId: (candidate._id as Types.ObjectId).toString(),
                    error: String(syncErr),
                });
            }
        }

        return res.status(200).json({ synced, failed });
    } catch (err) {
        logger.error({ message: "syncRagCandidates failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to sync RAG candidates" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/generations/:jobId/llm-io
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Return all GenerationLlmIO docs for a job, ordered by createdAt.
 * The jobId param can be the BullMQ jobId string or MongoDB _id.
 */
export async function getGenerationLlmIO(req: Request, res: Response) {
    const { jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ error: { message: "jobId is required" } });
    }

    try {
        // Resolve BullMQ jobId string → job record to confirm it exists
        const job = await GenerationJob.findOne(
            Types.ObjectId.isValid(jobId)
                ? { $or: [{ jobId }, { _id: new Types.ObjectId(jobId) }] }
                : { jobId }
        )
            .select("jobId")
            .lean();

        if (!job) {
            return res.status(404).json({ error: { message: "Job not found" } });
        }

        const entries = await GenerationLlmIO.find({ jobId: job.jobId })
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({ jobId: job.jobId, entries });
    } catch (err) {
        logger.error({ message: "getGenerationLlmIO failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to load LLM I/O log" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/rlhf/lessons
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List all CoderLessons newest-first.
 *
 * Query params:
 *   ?limit  — max rows to return (default 200, capped at 1000).
 *
 * Each row includes an `origin` field:
 *   "manual" — if sourcePrompt is null or the sentinel string "manual"
 *   "auto"   — otherwise (created by the worker after a debugged generation)
 */
export async function listLessons(req: Request, res: Response) {
    try {
        const rawLimit = parseInt(String(req.query.limit ?? "200"), 10);
        const limit = isNaN(rawLimit) || rawLimit < 1 ? 200 : Math.min(rawLimit, 1000);

        const docs = await CoderLesson.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .select("lesson sourcePrompt error jobId createdAt")
            .lean();

        const lessons = docs.map((d) => ({
            id: (d._id as Types.ObjectId).toString(),
            lesson: d.lesson,
            sourcePrompt: d.sourcePrompt ?? null,
            error: d.error ?? null,
            jobId: d.jobId ?? null,
            createdAt: d.createdAt,
            origin: (!d.sourcePrompt || d.sourcePrompt === "manual") ? "manual" : "auto",
        }));

        return res.status(200).json({ lessons, total: lessons.length });
    } catch (err) {
        logger.error({ message: "listLessons failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to list lessons" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/rlhf/lessons
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a manual CoderLesson.
 *
 * Body: { lesson: string }
 *
 * Sets sourcePrompt to the sentinel "manual" so the curation UI can distinguish
 * founder-authored lessons from worker-auto-generated ones.
 *
 * Validates: non-empty, ≤500 characters.
 * Writes an AdminAuditLog entry.
 */
export async function createLesson(req: Request, res: Response) {
    const adminId = req.userId;
    const { lesson } = req.body as { lesson?: string };

    if (!lesson || typeof lesson !== "string" || lesson.trim().length === 0) {
        return res.status(400).json({ error: { message: "lesson must be a non-empty string" } });
    }
    if (lesson.trim().length > 500) {
        return res.status(400).json({ error: { message: "lesson must be 500 characters or fewer" } });
    }

    try {
        const doc = await CoderLesson.create({
            lesson: lesson.trim(),
            sourcePrompt: "manual",
        });

        try {
            await AdminAuditLog.create({
                adminId: new Types.ObjectId(adminId!),
                action: "create_coder_lesson",
                targetType: "coder_lesson",
                targetId: (doc._id as Types.ObjectId).toString(),
                payload: { lesson: doc.lesson },
            });
        } catch { /* audit log failure is non-fatal */ }

        return res.status(201).json({
            id: (doc._id as Types.ObjectId).toString(),
            lesson: doc.lesson,
            sourcePrompt: doc.sourcePrompt ?? null,
            error: doc.error ?? null,
            jobId: doc.jobId ?? null,
            createdAt: doc.createdAt,
            origin: "manual",
        });
    } catch (err) {
        logger.error({ message: "createLesson failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to create lesson" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /admin/rlhf/lessons/:id
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Edit the text of an existing CoderLesson.
 *
 * Body: { lesson: string }
 *
 * Validates: non-empty, ≤500 characters, valid MongoDB ObjectId.
 * Returns the updated doc.
 * Writes an AdminAuditLog entry.
 */
export async function updateLesson(req: Request, res: Response) {
    const adminId = req.userId;
    const { id } = req.params;
    const { lesson } = req.body as { lesson?: string };

    if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: { message: "Invalid lesson id" } });
    }
    if (!lesson || typeof lesson !== "string" || lesson.trim().length === 0) {
        return res.status(400).json({ error: { message: "lesson must be a non-empty string" } });
    }
    if (lesson.trim().length > 500) {
        return res.status(400).json({ error: { message: "lesson must be 500 characters or fewer" } });
    }

    try {
        const doc = await CoderLesson.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: { lesson: lesson.trim() } },
            { new: true }
        ).lean();

        if (!doc) {
            return res.status(404).json({ error: { message: "Lesson not found" } });
        }

        try {
            await AdminAuditLog.create({
                adminId: new Types.ObjectId(adminId!),
                action: "update_coder_lesson",
                targetType: "coder_lesson",
                targetId: id,
                payload: { lesson: lesson.trim() },
            });
        } catch { /* audit log failure is non-fatal */ }

        return res.status(200).json({
            id: (doc._id as Types.ObjectId).toString(),
            lesson: doc.lesson,
            sourcePrompt: doc.sourcePrompt ?? null,
            error: doc.error ?? null,
            jobId: doc.jobId ?? null,
            createdAt: doc.createdAt,
            origin: (!doc.sourcePrompt || doc.sourcePrompt === "manual") ? "manual" : "auto",
        });
    } catch (err) {
        logger.error({ message: "updateLesson failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to update lesson" } });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /admin/rlhf/lessons/:id
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Delete a CoderLesson by its MongoDB ObjectId.
 *
 * Returns { ok: true } on success.
 * Writes an AdminAuditLog entry.
 */
export async function deleteLesson(req: Request, res: Response) {
    const adminId = req.userId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: { message: "Invalid lesson id" } });
    }

    try {
        const doc = await CoderLesson.findByIdAndDelete(new Types.ObjectId(id)).lean();

        if (!doc) {
            return res.status(404).json({ error: { message: "Lesson not found" } });
        }

        try {
            await AdminAuditLog.create({
                adminId: new Types.ObjectId(adminId!),
                action: "delete_coder_lesson",
                targetType: "coder_lesson",
                targetId: id,
                payload: { lesson: doc.lesson },
            });
        } catch { /* audit log failure is non-fatal */ }

        return res.status(200).json({ ok: true });
    } catch (err) {
        logger.error({ message: "deleteLesson failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to delete lesson" } });
    }
}
