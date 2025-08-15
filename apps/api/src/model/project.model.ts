import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Just remember I am storing the array of object Id's so don't ever call map without populating them. Always populate before mapping!!

// Interface representing a Project document in MongoDB
export interface IProject extends Document {
    name: string;
    tracks: Types.ObjectId[]; // Array of Track IDs for timeline
    duration: number;
    bytes: number;
    compiled: boolean;
    playback_url: string;
    preview_url?: string; // For on-demand previews
    fps: number; // Frames per second
    resolution: { width: number; height: number };
    status: 'draft' | 'in_progress' | 'compiled' | 'error';
}

// Project Schema
const ProjectSchema = new Schema<IProject>({
    name: { type: String, required: true },
    tracks: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
    duration: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    compiled: { type: Boolean, default: false },
    playback_url: { type: String, default: "" },
    preview_url: { type: String, default: "" },
    fps: { type: Number, default: 30 },
    resolution: {
        width: { type: Number, default: 1920 },
        height: { type: Number, default: 1080 }
    },
    status: { type: String, enum: ['draft', 'in_progress', 'compiled', 'error'], default: 'draft' }
}, { timestamps: true });


// Create the Project model
const Project: Model<IProject> = model<IProject>('Project', ProjectSchema);

export default Project;