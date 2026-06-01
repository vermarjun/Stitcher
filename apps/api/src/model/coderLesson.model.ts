/**
 * CoderLesson — auto-generated 1–2 line lessons learned from failed + debugged
 * generation jobs. Produced by the /reflect agent endpoint after the debug loop
 * ends (best-effort, non-fatal).
 *
 * These rows are injected into future /code calls as `coderMemory` so the coder
 * model is aware of past mistakes. The worker fetches the most-recent N (25)
 * lessons before each code-generation call.
 */

import { Schema, Document, Model, model } from "mongoose";

export interface ICoderLesson extends Document {
    /** 1–2 sentence lesson: what went wrong and how to avoid it. */
    lesson: string;
    /** The original user prompt that triggered the failure (for context). */
    sourcePrompt?: string;
    /** The final error that caused the debug loop to exhaust. */
    error?: string;
    /** The code fix / change summary that resolved the issue (if resolved). */
    fix?: string;
    /** BullMQ jobId of the originating generation job. */
    jobId?: string;
    createdAt: Date;
}

const CoderLessonSchema = new Schema<ICoderLesson>(
    {
        lesson: { type: String, required: true },
        sourcePrompt: { type: String, required: false },
        error: { type: String, required: false },
        fix: { type: String, required: false },
        jobId: { type: String, required: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Primary access: fetch most-recent N lessons (sorted descending).
CoderLessonSchema.index({ createdAt: -1 });

const CoderLesson: Model<ICoderLesson> = model<ICoderLesson>(
    "CoderLesson",
    CoderLessonSchema
);

export default CoderLesson;
