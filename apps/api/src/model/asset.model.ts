import {Schema, Document, Types, Model, model} from "mongoose";

export enum AssetType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

export enum AssetOrigin {
  UPLOAD = 'upload',
  GENERATED_VIDEO = 'generated_video'
}

export interface IAsset extends Document {
    name: string;
    type: AssetType;
    code?: string;
    scene_name?: string;
    scene_description?: string;
    origin: AssetOrigin;
    url: string;
    thumbnail: string;
    duration?: number;
    width?: number;
    height?: number;
    bytes: number;
    metadata: Record<string, any>;
    projectId: Types.ObjectId;
    isOnTimeline: boolean;
    waveformPeaks?: number[] | null;
}

const AssetSchema = new Schema<IAsset>({
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(AssetType), required: true },
    code: { type: String, required: false },
    scene_name: { type: String, required: false },
    scene_description: { type: String, required: false },
    origin: {type: String, enum: Object.values(AssetOrigin), required: true, default: AssetOrigin.GENERATED_VIDEO},
    url: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    duration: { type: Number },
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    isOnTimeline: {type: Boolean, default: false},
    waveformPeaks: { type: [Number], default: null },
}, { timestamps: true });

AssetSchema.index({ projectId: 1, origin: 1 });

const Asset: Model<IAsset> = model<IAsset>('Asset', AssetSchema);
export default Asset;