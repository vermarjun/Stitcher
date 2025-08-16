import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Project document in MongoDB
export interface IProject extends Document {
    name: string;
    timeline: Types.ObjectId; // Single Timeline reference
    chats: Types.ObjectId; // Single chats reference
    bytes: number;
    compiled: boolean;
    playback_url: string;
    preview_url?: string;
    status: 'draft' | 'in_progress' | 'compiled' | 'error';
}

// Project Schema
const ProjectSchema = new Schema<IProject>({
    name: { type: String, required: true },
    timeline: { type: Schema.Types.ObjectId, ref: 'Timeline', required: true }, // Reference to Timeline model
    chats: { type: Schema.Types.ObjectId, ref: 'Chat', required: true }, // Reference to Chat model
    bytes: { type: Number, default: 0 },
    compiled: { type: Boolean, default: false },
    playback_url: { type: String, default: "" },
    preview_url: { type: String, default: "" },
    status: { type: String, enum: ['draft', 'in_progress', 'compiled', 'error'], default: 'draft' }
}, { timestamps: true });

// Create the Project model
const Project: Model<IProject> = model<IProject>('Project', ProjectSchema);

export default Project;