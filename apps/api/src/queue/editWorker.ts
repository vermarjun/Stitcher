/**
 * BullMQ worker for the video-edit pipeline.
 *
 * Pipeline steps per job:
 *   1. Credit check (user.credits.editing)
 *   2. Load existing Asset (code, scene_name, scene_description, metadata)
 *   3. Build synthetic SceneSpec from asset metadata + editPrompt
 *   4. RAG enhance the editPrompt with the existing code as context
 *   5. Agent /code with the synthetic SceneSpec + existing code as a codeExample
 *   6. Render → debug-retry x2 → re-render (same budget pattern as generation)
 *   7. Persist new Asset (metadata.parentAssetId links to original)
 *   8. If timelineItemId provided: update TimelineItem.assetId to new asset
 *   9. Append assistant message to EditChat with new asset ID + URL
 *  10. Decrement user.credits.editing (atomic $gt:0 guard)
 *  11. Best-effort RAG corpusAdd
 *
 * Worker concurrency = 4; lockDuration = 600 s (render is slow).
 */

import { Worker, Job } from "bullmq";
import { Types } from "mongoose";
import { redisConnection } from "./connection";
import { ragClient } from "../services/ragClient";
import { agentClient } from "../services/agentClient";
import { renderClient } from "../services/renderClient";
import { ServiceError } from "../services/ServiceError";
import { resolveModelConfig } from "./modelConfig.util";
import { publishProgress } from "./eventPublisher.util";
import EditChat from "../model/editChat.model";
import Asset, { AssetType, AssetOrigin } from "../model/asset.model";
import TimelineItem from "../model/timelineitem.model";
import User from "../model/user.model";
import logger from "../util/logger.util";
import { AppError } from "../util/AppError";
import type { EditJobData, EditJobResult } from "./editTypes";
import type { SceneSpec, StyleManifest } from "../services/agentClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RENDER_ATTEMPTS = 2;

// Default style manifest — used when no stored style is available for the asset.
// The coder will override specifics based on the edit prompt anyway.
const DEFAULT_STYLE_MANIFEST: StyleManifest = {
    primaryColor: "#FFFFFF",
    secondaryColor: "#AAAAAA",
    backgroundColor: "#000000",
    accentColor: "#58C4DD",
    fontFamily: "LaTeX",
    animationPace: "medium",
    positioningZones: {},
    elementNaming: {},
};

// ─── Worker process function ──────────────────────────────────────────────────

async function processEditJob(
    job: Job<EditJobData, EditJobResult>
): Promise<EditJobResult> {
    const { editChatId, userId, projectId, assetId, timelineItemId, editPrompt, traceId } =
        job.data;

    // ── Progress helper ──────────────────────────────────────────────────────
    const progress = (type: string, phase: string, data?: unknown) => {
        publishProgress(editChatId, { type: type as Parameters<typeof publishProgress>[1]["type"], phase, data });
        logger.debug({ message: `[editWorker] ${type}`, editChatId, traceId, phase });
    };

    // ── Step 1: Credit check ─────────────────────────────────────────────────
    const user = await User.findById(userId).select("credits isTestAccount").lean();
    if (!user) {
        throw new AppError(404, `User ${userId} not found`, "user_not_found");
    }
    if (!user.isTestAccount && user.credits.editing <= 0) {
        throw new AppError(402, "Insufficient editing credits", "insufficient_credits");
    }

    // ── Step 2: Resolve model config ─────────────────────────────────────────
    const modelConfig = await resolveModelConfig(userId);

    // ── Step 3: Load source asset ────────────────────────────────────────────
    progress("edit_started", "load_asset");

    const sourceAsset = await Asset.findById(assetId)
        .select("code scene_name scene_description metadata projectId duration")
        .lean();

    if (!sourceAsset) {
        throw new AppError(404, `Asset ${assetId} not found`, "asset_not_found");
    }

    if (!sourceAsset.code) {
        throw new AppError(422, `Asset ${assetId} has no stored code — cannot edit`, "asset_no_code");
    }

    const existingCode = sourceAsset.code;
    const sceneClass = sourceAsset.scene_name ?? "Scene";
    const sceneDescription = sourceAsset.scene_description ?? editPrompt.slice(0, 200);
    // Duration: prefer stored asset duration (in seconds), fall back to 6 s
    const durationSec = (sourceAsset.duration != null && sourceAsset.duration > 0)
        ? sourceAsset.duration
        : 6;

    // ── Step 4: Build synthetic SceneSpec ────────────────────────────────────
    const syntheticScene: SceneSpec = {
        index: 0,
        prompt: editPrompt,
        durationSec,
        manimFeatures: [],
        requiredSymbols: [],
        description: sceneDescription,
    };

    // ── Step 5: RAG enhance ──────────────────────────────────────────────────
    progress("edit_started", "rag_enhance");

    let groundedPrompt = editPrompt;
    let ragCodeExamples: Array<{ description: string; code: string }> = [];

    // Always include existing code as a code example so the coder knows
    // what it is modifying
    ragCodeExamples.push({
        description: `Existing Manim scene code for "${sceneDescription}". Modify this to satisfy the edit prompt.`,
        code: existingCode,
    });

    try {
        const ragResult = await ragClient.enhance(
            { prompt: `${editPrompt} --- existing code context: ${existingCode.slice(0, 400)}` },
            traceId
        );
        groundedPrompt = ragResult.groundedPrompt;
        const apiExamples = ragResult.structuredContext.apiExamples.map((e) => ({
            description: e.docstring ?? e.symbol,
            code: e.snippet,
        }));
        // existing code goes first so the coder sees it as the primary reference
        ragCodeExamples = [ragCodeExamples[0], ...apiExamples];
    } catch (ragErr) {
        logger.warn({ message: "[editWorker] RAG enhance failed; using raw prompt", traceId, error: String(ragErr) });
    }

    // ── Step 6: Agent /code ──────────────────────────────────────────────────
    // We use /code (not /debug) because this is an intentional edit, not a
    // bug-fix. We give the coder the existing code as a prominent codeExample
    // so it can produce a minimal-diff modified version rather than starting
    // from scratch.
    progress("edit_started", "agent_code");

    const codeResponse = await agentClient.code(
        {
            scenePlan: { ...syntheticScene, prompt: groundedPrompt },
            styleManifest: DEFAULT_STYLE_MANIFEST,
            codeExamples: ragCodeExamples,
            modelConfig: {
                coder: modelConfig.coder,
                validator: modelConfig.validator,
            },
            meta: { traceId },
        },
        traceId
    );

    if (!codeResponse.success || !codeResponse.output?.code) {
        throw new AppError(
            502,
            `Edit code generation failed: ${codeResponse.error?.summary ?? "unknown"}`,
            "edit_code_failed"
        );
    }

    let newCode = codeResponse.output.code;
    let newSceneClass = codeResponse.output.sceneClass ?? sceneClass;

    // ── Step 7: Render with debug-retry loop (budget = 2) ───────────────────
    progress("edit_started", "render");

    let renderUrl: string | undefined;
    let renderDurationSec = durationSec;
    let attempts = 0;
    let lastRenderError: string | undefined;

    while (attempts < MAX_RENDER_ATTEMPTS) {
        attempts++;

        const renderResponse = await renderClient.render({
            code: newCode,
            sceneClass: newSceneClass,
            render: { quality: "medium" },
            storage: {
                backend: "cloudinary",
                folder: `stitcher/scenes/${projectId}`,
                public: false,
                generateThumbnail: true,
                thumbnailAt: 1,
            },
            // 300s sandbox cap per scene; render service default is 120s
            // which is too aggressive for LaTeX-heavy scenes.
            limits: { timeoutSec: 300 },
            meta: { traceId },
        });

        if (renderResponse.success) {
            renderUrl = renderResponse.render.url;
            renderDurationSec = renderResponse.render.durationSec;
            progress("edit_render_complete", "render", { url: renderUrl, attempt: attempts });
            break;
        }

        // Render returned success:false — Manim execution failed
        lastRenderError = renderResponse.error.summary;
        logger.warn({
            message: "[editWorker] render failed",
            attempt: attempts,
            traceId,
            summary: lastRenderError,
        });

        if (attempts >= MAX_RENDER_ATTEMPTS) break;

        // Debug: ask agent to fix the generated code
        try {
            const debugResponse = await agentClient.debug(
                {
                    brokenCode: newCode,
                    sceneClass: newSceneClass,
                    error: {
                        stderr: renderResponse.error.stderr,
                        summary: renderResponse.error.summary,
                        line: renderResponse.error.line,
                        category: renderResponse.error.category,
                    },
                    originalPrompt: editPrompt,
                    modelConfig: {
                        debugger: modelConfig.debugger,
                        validator: modelConfig.validator,
                    },
                    meta: { traceId },
                },
                traceId
            );

            if (debugResponse.success && debugResponse.output?.code) {
                newCode = debugResponse.output.code;
                if (debugResponse.output.sceneClass) {
                    newSceneClass = debugResponse.output.sceneClass;
                }
            }
        } catch (debugErr) {
            logger.warn({ message: "[editWorker] debug call failed", traceId, error: String(debugErr) });
        }
    }

    if (!renderUrl) {
        throw new AppError(
            502,
            `Edit render failed after ${MAX_RENDER_ATTEMPTS} attempts: ${lastRenderError ?? "unknown"}`,
            "edit_render_failed"
        );
    }

    // ── Step 8: Persist new Asset ────────────────────────────────────────────
    const newAsset = new Asset({
        name: `${newSceneClass}-edit-${editChatId}`,
        type: AssetType.VIDEO,
        code: newCode,
        scene_name: newSceneClass,
        scene_description: sceneDescription,
        origin: AssetOrigin.GENERATED_VIDEO,
        url: renderUrl,
        thumbnail: renderUrl,
        duration: renderDurationSec,
        bytes: 0,
        metadata: {
            traceId,
            parentAssetId: assetId,
            editPrompt,
        },
        projectId: new Types.ObjectId(projectId),
        isOnTimeline: false,
    });
    await newAsset.save();

    const newAssetId = (newAsset._id as Types.ObjectId).toString();

    // ── Step 9: Update TimelineItem if provided ──────────────────────────────
    if (timelineItemId) {
        try {
            await TimelineItem.findByIdAndUpdate(
                timelineItemId,
                { assetId: newAsset._id },
                { new: true }
            );
            logger.debug({ message: "[editWorker] TimelineItem updated", timelineItemId, newAssetId, traceId });
        } catch (tlErr) {
            // Non-fatal — asset is persisted; timeline update failure logged
            logger.warn({ message: "[editWorker] TimelineItem update failed", timelineItemId, traceId, error: String(tlErr) });
        }
    }

    // ── Step 10: Append assistant message to EditChat ────────────────────────
    await EditChat.findByIdAndUpdate(
        editChatId,
        {
            $push: {
                messages: {
                    role: "assistant",
                    content: {
                        llmResponse: renderUrl,
                        newAssetId,
                        newAssetUrl: renderUrl,
                    },
                    timestamp: new Date(),
                    timelineObject: {},
                },
            },
        }
    );

    // ── Step 11: Decrement editing credits (atomic; won't go below zero) ─────
    if (!user.isTestAccount) {
        await User.updateOne(
            { _id: userId, "credits.editing": { $gt: 0 } },
            { $inc: { "credits.editing": -1 } }
        );
    }

    // ── Step 12: Best-effort RAG corpusAdd ───────────────────────────────────
    try {
        await ragClient.corpusAdd(
            {
                documents: [
                    {
                        child: { prompt: editPrompt, code: newCode, sceneClass: newSceneClass },
                        metadata: { traceId, editChatId, projectId, parentAssetId: assetId },
                    },
                ],
            },
            traceId
        );
    } catch (ragErr) {
        logger.warn({ message: "[editWorker] RAG corpusAdd failed (non-fatal)", traceId, error: String(ragErr) });
    }

    progress("edit_complete", "done", { newAssetId, newAssetUrl: renderUrl });

    return {
        newAssetId,
        newAssetUrl: renderUrl,
        durationSec: renderDurationSec,
    };
}

// ─── Worker instance ──────────────────────────────────────────────────────────

export const editWorker = new Worker<EditJobData, EditJobResult>(
    "video-edit",
    processEditJob,
    {
        connection: redisConnection,
        concurrency: 4,
        lockDuration: 600_000, // 10 minutes — render is synchronous and slow
    }
);

// ─── Worker event listeners ───────────────────────────────────────────────────

editWorker.on("failed", (job, err) => {
    logger.error({
        message: "edit job failed",
        jobId: job?.id,
        editChatId: job?.data.editChatId,
        error: String(err),
        traceId: job?.data.traceId,
    });

    if (job) {
        const isRetryable = err instanceof ServiceError && err.status === 503;
        publishProgress(job.data.editChatId, {
            type: "edit_failed" as Parameters<typeof publishProgress>[1]["type"],
            phase: "worker",
            data: {
                error: String(err),
                retryable: isRetryable,
                jobId: job.id,
            },
        });

        // Append a failed assistant message to EditChat so the UI can reflect it
        EditChat.findByIdAndUpdate(
            job.data.editChatId,
            {
                $push: {
                    messages: {
                        role: "assistant",
                        content: {
                            llmResponse: `Edit failed: ${err instanceof AppError ? err.message : "Unknown error"}`,
                            error: err instanceof AppError ? (err.code ?? "edit_failed") : "edit_failed",
                        },
                        timestamp: new Date(),
                        timelineObject: {},
                    },
                },
            }
        ).catch((mongoErr: unknown) => {
            logger.error({
                message: "[editWorker] Failed to append error message to EditChat",
                editChatId: job.data.editChatId,
                error: String(mongoErr),
            });
        });
    }
});

editWorker.on("completed", (job, result) => {
    logger.info({
        message: "edit job completed",
        jobId: job.id,
        editChatId: job.data.editChatId,
        newAssetUrl: result.newAssetUrl,
        traceId: job.data.traceId,
    });
    publishProgress(job.data.editChatId, {
        type: "edit_complete" as Parameters<typeof publishProgress>[1]["type"],
        phase: "worker",
        data: result,
    });
});

editWorker.on("error", (err) => {
    logger.error({ message: "editWorker error event", error: String(err) });
});
