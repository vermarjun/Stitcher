import {Schema, Document, Types, Model, model} from "mongoose";

// Simplified animation types if needed for text
export enum TextAnimationType {
  FADE_IN = 'fadeIn',
  FADE_OUT = 'fadeOut',
  NONE = 'none'
}

// Base interface for TimelineItem
export interface ITimelineItemBase extends Document {
    type: 'video' | 'audio' | 'image' | 'text';
    trackId: Types.ObjectId;
    startTime: number; // Position on timeline in seconds
    endTime: number;   // Position on timeline in seconds
    assetId?: Types.ObjectId; // Reference to Asset for video/audio/image
    metadata: Record<string, any>;
    // Shared properties
    volume?: number; // For audio/video
    opacity?: number; // 0-1 for video/image/text
    x?: number; // Position for overlays
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
}

// Specific extensions (not enforced in schema, but for TS)
export interface IVideoTimelineItem extends ITimelineItemBase {
    type: 'video';
    assetId: Types.ObjectId;
    sourceStartTime: number; // Trim start in source
    sourceEndTime: number;   // Trim end in source
    speed: number; // Playback speed
}

export interface IAudioTimelineItem extends ITimelineItemBase {
    type: 'audio';
    assetId: Types.ObjectId;
    sourceStartTime: number;
    sourceEndTime: number;
    volume: number;
    fadeIn?: number;
    fadeOut?: number;
}

export interface IImageTimelineItem extends ITimelineItemBase {
    type: 'image';
    assetId: Types.ObjectId;
}

export interface ITextTimelineItem extends ITimelineItemBase {
    type: 'text';
    content: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    animationIn?: TextAnimationType;
    animationOut?: TextAnimationType;
    // Omit assetId for text
}

export type ITimelineItem = IVideoTimelineItem | IAudioTimelineItem | IImageTimelineItem | ITextTimelineItem;

// TimelineItem Schema (flexible for all types)
const TimelineItemSchema = new Schema<ITimelineItem>({
    type: { type: String, enum: ['video', 'audio', 'image', 'text'], required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track', required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    // Shared optional fields
    volume: { type: Number },
    opacity: { type: Number },
    x: { type: Number },
    y: { type: Number },
    scaleX: { type: Number },
    scaleY: { type: Number },
    rotation: { type: Number },
    // Video/audio specific
    sourceStartTime: { type: Number },
    sourceEndTime: { type: Number },
    speed: { type: Number },
    fadeIn: { type: Number },
    fadeOut: { type: Number },
    // Text specific
    content: { type: String },
    fontFamily: { type: String },
    fontSize: { type: Number },
    color: { type: String },
    animationIn: { type: String, enum: Object.values(TextAnimationType) },
    animationOut: { type: String, enum: Object.values(TextAnimationType) }
}, { timestamps: true });

// Pre-save hook to validate fields based on type (optional, for robustness)
TimelineItemSchema.pre('save', function(next) {
    const item = this as ITimelineItem;
    if (['video', 'audio', 'image'].includes(item.type) && !item.assetId) {
        return next(new Error(`${item.type} items require an assetId`));
    }
    if (item.type === 'text' && !item.content) {
        return next(new Error('Text items require content'));
    }
    next();
});

// Create the TimelineItem model
const TimelineItem: Model<ITimelineItem> = model<ITimelineItem>('TimelineItem', TimelineItemSchema);

export default TimelineItem;