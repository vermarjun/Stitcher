import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Prompt document in MongoDB
export interface IPrompt extends Document {
    code: string;
    response: string; //LLM KA RESPONSE BHI TO SAVE KR BSDK
    prompt: string;
    compiled: boolean;
    metadata: Record<string, any>;
    description?: string; //optional rakh de abhi ke liye
    assetId?: Types.ObjectId; // If this prompt generates an asset (e.g., AI video clip)
}

// Prompt Schema
const PromptSchema = new Schema<IPrompt>({
    code: { type: String, required: true },
    prompt: { type: String, required: true },
    response: { type: String, default: "" },
    compiled: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
    description: { type: String },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' }
}, { timestamps: true });

// Create the Prompt model
const Prompt: Model<IPrompt> = model<IPrompt>('Prompt', PromptSchema);

export default Prompt;