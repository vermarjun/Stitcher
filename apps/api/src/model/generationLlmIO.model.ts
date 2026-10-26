/**
 * GenerationLlmIO — full verbatim LLM input/output captured for every call
 * made by the generation pipeline (agent /code, /debug, /reflect stages).
 *
 * Persisted best-effort after every agent call, including failed calls.
 * Each string field is safety-capped at ~100KB to prevent runaway doc sizes.
 *
 * Safety-cap constant: strings over IO_FIELD_CAP bytes are sliced before insert.
 *
 * Note: the LLM model name is stored as `llmModel` rather than `model` to
 * avoid the naming conflict with Mongoose Document's built-in `model` method.
 */

import { Schema, Document, Types, Model, model } from "mongoose";

export type LlmIOStage = "agent_code" | "agent_debug" | "query_transform" | "rag_enhance" | "reflect";

/** 100 KB safety cap for large string fields. */
export const IO_FIELD_CAP = 100_000;

export interface IGenerationLlmIO extends Document {
    /** BullMQ job id (matches GenerationJob.jobId). */
    jobId: string;
    chatId?: Types.ObjectId;
    stage: LlmIOStage;
    /** Scene index (always 0 in the single-scene pipeline). */
    sceneIndex?: number;
    /** Which attempt number within the debug loop (0 = initial code call). */
    attempt: number;
    /** LLM role identifier from the agent (e.g. "coder", "debugger"). */
    role: string;
    provider: string;
    /** LLM model id (stored as llmModel to avoid clash with Mongoose Document.model). */
    llmModel: string;
    /** Full system message sent (capped). */
    systemPrompt: string;
    /** Full user message sent (capped). */
    userPrompt: string;
    /** Exact messages array sent to the model (capped via JSON.stringify). */
    fullInput?: unknown;
    /** Raw LLM response content verbatim (capped). */
    rawOutput: string;
    tokensUsed?: { input: number; output: number };
    /** Error string if the LLM call or agent call itself failed. */
    error?: string;
    /**
     * Non-LLM RAG pipeline data (embed, retrieve, select phases).
     * Populated only on the stage="rag_enhance" / role="retrieval" row.
     * Stored as Mixed so the shape can evolve without schema migrations.
     */
    retrievalTrace?: unknown;
    createdAt: Date;
}

const GenerationLlmIOSchema = new Schema<IGenerationLlmIO>(
    {
        jobId: { type: String, required: true, index: true },
        chatId: { type: Schema.Types.ObjectId, required: false },
        stage: {
            type: String,
            enum: ["agent_code", "agent_debug", "query_transform", "rag_enhance", "reflect"],
            required: true,
        },
        sceneIndex: { type: Number, required: false },
        attempt: { type: Number, required: true, default: 0 },
        role: { type: String, required: true },
        provider: { type: String, required: true },
        llmModel: { type: String, required: true },
        systemPrompt: { type: String, required: true },
        userPrompt: { type: String, required: true },
        fullInput: { type: Schema.Types.Mixed, required: false },
        rawOutput: { type: String, required: true },
        tokensUsed: {
            type: new Schema(
                { input: { type: Number }, output: { type: Number } },
                { _id: false }
            ),
            required: false,
        },
        error: { type: String, required: false },
        retrievalTrace: { type: Schema.Types.Mixed, required: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Primary access: fetch all rows for a given BullMQ jobId, ordered by time.
GenerationLlmIOSchema.index({ jobId: 1, createdAt: 1 });

const GenerationLlmIO: Model<IGenerationLlmIO> = model<IGenerationLlmIO>(
    "GenerationLlmIO",
    GenerationLlmIOSchema
);

export default GenerationLlmIO;
