import {Schema, Document, Types, Model, model} from "mongoose";

export enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  OVERLAY = 'overlay' // For images and text overlays
}

// Interface representing a Track document
export interface ITrack extends Document {
    name: string;
    type: TrackType;
    projectId: Types.ObjectId;
    order: number; // Layer order (higher = on top)
    locked: boolean;
    muted: boolean;
    items: Types.ObjectId[]; // References to TimelineItems
}

// Track Schema
const TrackSchema = new Schema<ITrack>({
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(TrackType), required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    order: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    items: [{ type: Schema.Types.ObjectId, ref: 'TimelineItem' }]
}, { timestamps: true });

// Create the Track model
const Track: Model<ITrack> = model<ITrack>('Track', TrackSchema);

export default Track;