import {Schema, Document, Types, Model, model} from "mongoose";

export enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text' // For text overlays
}

// Interface representing a Track document
export interface ITrack extends Document {
    type: TrackType;
    projectId: Types.ObjectId;
    timelineId: Types.ObjectId;
    order: number; // Layer order (higher = on top)
    locked: boolean;
    muted: boolean;
    items: Types.ObjectId[]; // References to TimelineItems
}

// Track Schema
const TrackSchema = new Schema<ITrack>({
    type: { type: String, enum: Object.values(TrackType), required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    timelineId: { type: Schema.Types.ObjectId, ref: 'Timeline', required: true },
    order: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    items: [{ type: Schema.Types.ObjectId, ref: 'TimelineItem' }]
}, { timestamps: true });

// Create the Track model
const Track: Model<ITrack> = model<ITrack>('Track', TrackSchema);

export default Track;