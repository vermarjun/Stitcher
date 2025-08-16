import {Schema, Document, Types, Model, model} from "mongoose";

// Interface representing a Timeline document in MongoDB
export interface ITimeline extends Document {
    projectId: Types.ObjectId; // One-to-one with Project
    tracks: Types.ObjectId[]; // References to Track documents
    duration: number; // Total timeline duration in seconds
    fps: number; // Frames per second
    resolution: { width: number; height: number };
    snapToGrid?: boolean; // Optional for timeline snapping
    gridSize?: number; // In seconds, for snapping
    zoom?: number; // UI zoom level
}

// Timeline Schema
const TimelineSchema = new Schema<ITimeline>({
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true }, // Ensures one timeline per project
    tracks: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
    duration: { type: Number, default: 0 },
    fps: { type: Number, default: 30 },
    resolution: {
        width: { type: Number, default: 1920 },
        height: { type: Number, default: 1080 }
    },
    snapToGrid: { type: Boolean, default: true },
    gridSize: { type: Number, default: 0.1 }, // 100ms grid
    zoom: { type: Number, default: 1 }
}, { timestamps: true });

// Create the Timeline model
const Timeline: Model<ITimeline> = model<ITimeline>('Timeline', TimelineSchema);

export default Timeline;