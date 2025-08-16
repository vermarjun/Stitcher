import {Schema, Document, Types, Model, model, ObjectId} from "mongoose";

export enum AssetType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  TEXT = 'text' // For text overlays, though text might not need an asset if it's just string content
}

// Interface representing an Asset document in MongoDB
export interface IAsset extends Document {
    name: string;
    type: AssetType;
    url: string; // Storage URL (e.g., Cloudinary or S3)
    duration?: number; // For video/audio in seconds
    width?: number;
    height?: number;
    bytes: number;
    metadata: Record<string, any>;
    projectId: Types.ObjectId;
}

// Asset Schema
const AssetSchema = new Schema<IAsset>({
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(AssetType), required: true },
    url: { type: String, required: true },
    duration: { type: Number },
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true }
}, { timestamps: true });

// Create the Asset model
const Asset: Model<IAsset> = model<IAsset>('Asset', AssetSchema);

export default Asset;