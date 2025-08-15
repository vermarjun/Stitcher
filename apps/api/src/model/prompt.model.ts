import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Project document in MongoDB
export interface IPrompt {
    code: string;
    response: string; //LLM KA RESPONSE BHI TO SAVE KR BSDK
    prompt: string;
    compiled: boolean;
    metadata: Record<string, any>;
    description?: string; //optional rakh de abhi ke liye
}
// Project Schema
const PromptSchema = new Schema<IPrompt>({
    code: { type: String, required: true },
    prompt: { type: String, required: true },
    compiled: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Create the Scene model
const Prompt: Model<IPrompt> = model<IPrompt>('Prompt', PromptSchema);

export default Prompt;