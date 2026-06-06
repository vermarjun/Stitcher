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

export type StageId =
    | "rag_enhance"
    | "agent_plan"
    | "agent_code"
    | "render"
    | "agent_debug"
    | "tts"
    | "concat"
    | "upload";

export type StageService =
    | "stitcher-api"
    | "stitcher-rag"
    | "stitcher-agent"
    | "stitcher-render";

export interface IJobStage {
    stage: StageId;
    service: StageService;
    sceneIndex?: number;
    status: "ok" | "failed";
    /** Full error message or stack on failure. */
    error?: string;
    startedAt: Date;
    endedAt: Date;
    durationMs: number;
    tokens?: { input: number; output: number; total: number };
    /** LLM model id used for this stage (if any). */
    model?: string;
    /** Short human-readable summary of what this stage returned. */
    outputSummary?: string;
    /** Generated Manim code at time of failure (capped to 8 KB). Set on agent_code / agent_debug / render when the scene fails. */
    failedCode?: string;
}

export interface ISceneProgress {
    done: number;
    total: number;
}

/**
 * Live user-facing progress snapshot — the granular phase the pipeline is
 * currently on, persisted so a page reload restores the exact bar position.
 *
 * Unlike `status` (coarse: queued/planning/rendering/…) this carries the real
 * fine-grained phase (rag/code/voiceover/render/debug/upload) plus the label +
 * percentage shown to the user. The canonical phase→{label,percent,ceil} map
 * lives in `queue/pipelinePhases.ts`; this is the persisted snapshot of it.
 */
export interface IJobProgress {
    /** Canonical pipeline phase key (queued|rag|code|voiceover|render|debug|upload|done|failed). */
    phase: string;
    /** Human-readable label shown above the progress bar. */
    label: string;
    /** Real percentage floor (0–100) for the current phase. Monotonic (never decreases). */
    percent: number;
    /** Upper cap the client may slowly creep toward while the phase runs. */
    ceil: number;
    updatedAt: Date;
}

export type CurationStatus = "unreviewed" | "approved" | "rejected";

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
    /** Live granular progress snapshot (phase + label + percent), persisted for reload-safe UI. */
    progress?: IJobProgress;
    finalUrl?: string;
    /** Final generated Manim code persisted for curation/RAG pipeline. */
    finalCode?: string;
    error?: string;
    traceId?: string;
    startedAt: Date;
    completedAt?: Date;
    /** LLM token usage — populated by the worker once the agent emits usage data. */
    tokens?: { input: number; output: number };
    /** Estimated USD cost derived from token usage. Forward-compat; see §5. */
    costUsd?: number;
    /** Per-stage ticket record. Each pipeline step pushes one row here (best-effort). */
    stages: IJobStage[];
    /** RLHF: 1–5 star rating submitted by the user after viewing the video. */
    rating?: number | null;
    /** When the rating was set. */
    ratedAt?: Date;
    /** Admin curation decision for RAG pipeline. */
    curationStatus: CurationStatus;
    /** Whether the debug loop was invoked at least once for this job. */
    debugInvoked: boolean;
    /** Whether a render eventually succeeded after the debug loop ran. */
    debugResolved: boolean;
    /**
     * Resilience telemetry (admin "real vs fallback" visibility):
     *  - usedFallbackLlm: the primary coder failed and the admin-defined
     *    FALLBACK LLM produced the code that was used.
     *  - usedFallbackScene: no LLM produced usable code, so the guaranteed
     *    title-card scene was rendered (a "soft fail" — counts as NOT a real
     *    animation even though status is "complete").
     */
    usedFallbackLlm?: boolean;
    usedFallbackScene?: boolean;
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

const JobProgressSchema = new Schema<IJobProgress>(
    {
        phase: { type: String, required: true },
        label: { type: String, required: true },
        percent: { type: Number, required: true },
        ceil: { type: Number, required: true },
        updatedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const JobStageTokensSchema = new Schema(
    {
        input: { type: Number },
        output: { type: Number },
        total: { type: Number },
    },
    { _id: false }
);

const JobStageSchema = new Schema<IJobStage>(
    {
        stage: {
            type: String,
            enum: ["rag_enhance", "agent_plan", "agent_code", "render", "agent_debug", "tts", "concat", "upload"],
            required: true,
        },
        service: {
            type: String,
            enum: ["stitcher-api", "stitcher-rag", "stitcher-agent", "stitcher-render"],
            required: true,
        },
        sceneIndex: { type: Number, required: false },
        status: { type: String, enum: ["ok", "failed"], required: true },
        error: { type: String, required: false },
        startedAt: { type: Date, required: true },
        endedAt: { type: Date, required: true },
        durationMs: { type: Number, required: true },
        tokens: { type: JobStageTokensSchema, required: false },
        model: { type: String, required: false },
        outputSummary: { type: String, required: false },
        failedCode: { type: String, required: false },
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
        progress: { type: JobProgressSchema, required: false },
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
        stages: { type: [JobStageSchema], default: [] },
        finalCode: { type: String, required: false },
        rating: { type: Number, default: null, required: false },
        ratedAt: { type: Date, required: false },
        curationStatus: {
            type: String,
            enum: ["unreviewed", "approved", "rejected"],
            default: "unreviewed",
        },
        debugInvoked: { type: Boolean, default: false },
        debugResolved: { type: Boolean, default: false },
        usedFallbackLlm: { type: Boolean, default: false },
        usedFallbackScene: { type: Boolean, default: false },
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
