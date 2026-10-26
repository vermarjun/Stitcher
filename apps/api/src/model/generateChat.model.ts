import { Schema, Document, Types, Model, model } from "mongoose";

// Interface for Scene
export interface IScene {
    prompt: string;
    code: string;
    sceneName: string;
    summary: string;
    assetId: Types.ObjectId;
    RequiredMObjects: string[];
    RequiredAnimations: string[];
    error: string | null;
}

// Interface for assistant message content
export interface IAssistantContent {
    plannerOutput: string;
    llmResponse: string;
}

// Interface for individual messages in a chat
export interface IGenerateChatMessage {
    role: string; //'user' | 'assistant'
    content: string | IAssistantContent; // String for user, IAssistantContent for assistant
    timestamp: Date;
    scenes: IScene[]; // Empty array for user messages, array of scenes for assistant messages
    projectDescription: string;
    completed: boolean;
    plannerOut: boolean;
    generatorOutput: boolean;
    error: string;
    requestType: string | undefined;
    assetsToEdit: Types.ObjectId[]; // If the request is to edit a video, the user must have passed an array of assets he wants to edit, so save their ID
    generationMs?: number; // Wall-clock time the pipeline took to produce this video (ms). Persisted so "time taken" survives reloads.
}

// Interface representing a Chat document in MongoDB
export interface IGenerateChat extends Document {
    title: string; // Auto-generated from the first prompt
    messages: IGenerateChatMessage[];
    projectId: Types.ObjectId; // Generate chat's projectId
    userId: Types.ObjectId;
}

// Scene Schema
const SceneSchema = new Schema<IScene>({
    prompt: { type: String, required: false },
    code: { type: String, required: false },
    sceneName: { type: String, required: false },
    summary: { type: String, required: false },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: false },
    RequiredMObjects: { type: [String], default: [] },
    RequiredAnimations: { type: [String], default: [] },
    error: { type: String, default: null }
}, { _id: false });

// Chat Message Schema
const ChatMessageSchema = new Schema<IGenerateChatMessage>({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    scenes: { type: [SceneSchema], default: [] },
    timestamp: { type: Date, default: Date.now },
    projectDescription: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    plannerOut: { type: Boolean, default: false },
    generatorOutput: { type: Boolean, default: false },
    requestType: { type: String, enum: ["edit", "generate"], required: false }, // for assistant message this should be null but for user messages this should define what user wanted to do  
    assetsToEdit: [{
        type: Schema.Types.ObjectId,
        ref: 'Asset',
        default: []
    }],
    generationMs: { type: Number, required: false },
}, { _id: false });

// Chat Schema
const GenerateChatSchema = new Schema<IGenerateChat>({
    title: { type: String, required: true },
    messages: [ChatMessageSchema],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false }
}, { timestamps: true });

// Create the Chat model
const GenerateChat: Model<IGenerateChat> = model<IGenerateChat>('GenerateChat', GenerateChatSchema);

export default GenerateChat;