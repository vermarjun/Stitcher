/**
 * RagCandidate — approved generations awaiting embedding into the RAG corpus.
 *
 * Created by the /curate endpoint (admin-approved) and consumed by /rag/sync
 * which posts each pending candidate to the RAG service /corpus/add, then
 * marks it synced.
 */

import { Schema, Document, Types, Model, model } from "mongoose";

export type RagCandidateStatus = "pending" | "synced";

export interface IRagCandidate extends Document {
    jobId: Types.ObjectId;
    chatId?: Types.ObjectId;
    userId: Types.ObjectId;
    /** Full user prompt for this generation. */
    prompt: string;
    /** Final generated Manim code. */
    code: string;
    /** Top-level Manim scene class name. */
    sceneClass: string;
    /** API symbols used (from RAG query-transform). */
    apisUsed?: string[];
    /** User rating at time of curation (1–5). */
    rating?: number;
    status: RagCandidateStatus;
    createdAt: Date;
    syncedAt?: Date;
}

const RagCandidateSchema = new Schema<IRagCandidate>(
    {
        jobId: { type: Schema.Types.ObjectId, ref: "GenerationJob", required: true, index: true },
        chatId: { type: Schema.Types.ObjectId, required: false },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        prompt: { type: String, required: true },
        code: { type: String, required: true },
        sceneClass: { type: String, required: true },
        apisUsed: { type: [String], required: false },
        rating: { type: Number, required: false },
        status: {
            type: String,
            enum: ["pending", "synced"],
            default: "pending",
            index: true,
        },
        syncedAt: { type: Date, required: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Fast lookup for /rag/sync (all pending)
RagCandidateSchema.index({ status: 1, createdAt: 1 });

const RagCandidate: Model<IRagCandidate> = model<IRagCandidate>(
    "RagCandidate",
    RagCandidateSchema
);

export default RagCandidate;
