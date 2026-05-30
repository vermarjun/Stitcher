/**
 * GenerationJob — a persisted record of every generation / edit job (F2.4).
 *
 * Unlike the live Socket.IO progress event (ephemeral) and the admin-live
 * firehose (admin-only, in-memory), this model gives each USER a durable
 * history of their generations: what is in-flight, per-scene progress, and a
 * record of past jobs with their final status + URL.
 *
 * The BullMQ job id is stored as `jobId` so the row can be correlated with the
 * queue (bull-board, retries) and so the worker can advance the lifecycle.
 *
 * Lifecycle writes are intentionally CHEAP + NON-FATAL — the worker wraps every
 * update in try/catch so a Mongo hiccup never breaks a running pipeline.
 */

import { Schema, Document, Types, Model, model } from "mongoose";

export type GenerationJobQueue = "generation" | "edit";

export type GenerationJobStatus =
    | "queued"
    | "planning"
    | "rendering"
    | "concatenating"
    | "uploading"
    | "complete"
    | "failed"
    | "cancelled";

export interface ISceneProgress {
    done: number;
    total: number;
}

export interface IGenerationJob extends Document {
    /** BullMQ job id (indexed). Empty string only if the queue failed to assign one. */
    jobId: string;
    queue: GenerationJobQueue;
    userId: Types.ObjectId;
    projectId?: Types.ObjectId;
    /** GenerateChat / EditChat document id this job belongs to. */
    chatId?: Types.ObjectId;
    /** Truncated prompt for display in the history list. */
    prompt: string;
    status: GenerationJobStatus;
    sceneProgress: ISceneProgress;
    finalUrl?: string;
    error?: string;
    traceId?: string;
    startedAt: Date;
    completedAt?: Date;
    /** LLM token usage — populated by the worker once the agent emits usage data. */
    tokens?: { input: number; output: number };
    /** Estimated USD cost derived from token usage. Forward-compat; see §5. */
    costUsd?: number;
    createdAt: Date;
    updatedAt: Date;
}

const SceneProgressSchema = new Schema<ISceneProgress>(
    {
        done: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    { _id: false }
);

const GenerationJobSchema = new Schema<IGenerationJob>(
    {
        jobId: { type: String, required: true, index: true },
        queue: { type: String, enum: ["generation", "edit"], required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        projectId: { type: Schema.Types.ObjectId, ref: "Project", required: false },
        chatId: { type: Schema.Types.ObjectId, required: false },
        prompt: { type: String, default: "" },
        status: {
            type: String,
            enum: [
                "queued",
                "planning",
                "rendering",
                "concatenating",
                "uploading",
                "complete",
                "failed",
                "cancelled",
            ],
            default: "queued",
            index: true,
        },
        sceneProgress: { type: SceneProgressSchema, default: () => ({ done: 0, total: 0 }) },
        finalUrl: { type: String, required: false },
        error: { type: String, required: false },
        traceId: { type: String, required: false },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, required: false },
        tokens: {
            type: new Schema(
                { input: { type: Number }, output: { type: Number } },
                { _id: false }
            ),
            required: false,
        },
        costUsd: { type: Number, required: false },
    },
    { timestamps: true }
);

// Primary access pattern: a user's history, newest-first.
GenerationJobSchema.index({ userId: 1, createdAt: -1 });

const GenerationJob: Model<IGenerationJob> = model<IGenerationJob>(
    "GenerationJob",
    GenerationJobSchema
);

export default GenerationJob;
