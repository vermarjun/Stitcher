import {Schema, Document, Types, Model, model} from "mongoose";

// Interface representing a Project document in MongoDB
export interface IProject extends Document {
    name: string;
    timeline: Types.ObjectId; // Single Timeline reference
    edit_chat: Types.ObjectId // Har project ke liye ek hi unique edit chat hogi!! Generate ke liye projectId se fetch it
    bytes: number;
    compiled: boolean;
    playback_url: string;
    preview_url?: string;
    project_script: string; // This is the projectDescription 
    status: 'draft' | 'in_progress' | 'compiled' | 'error';
}

// Project Schema
const ProjectSchema = new Schema<IProject>({
    name: { type: String, required: true },
    timeline: { type: Schema.Types.ObjectId, ref: 'Timeline'}, // Reference to Timeline model
    edit_chat: { type: Schema.Types.ObjectId, ref: 'EditChat'}, // Reference to Edit Chat 
    bytes: { type: Number, default: 0 },
    compiled: { type: Boolean, default: false },
    playback_url: { type: String, default: "" },
    preview_url: { type: String, default: "" },
    project_script:{ type: String, default: ""},
    status: { type: String, enum: ['draft', 'in_progress', 'compiled', 'error'], default: 'draft' }
}, { timestamps: true });

// Create the Project model
const Project: Model<IProject> = model<IProject>('Project', ProjectSchema);

export default Project;