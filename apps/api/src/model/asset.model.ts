import {Schema, Document, Types, Model, model, ObjectId} from "mongoose";

export enum AssetType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

export enum AssetOrigin {
  TEMPLATE = 'template',
  UPLOAD = 'upload',
  GENERATED_VIDEO = 'generated_video'
}

export interface IAsset extends Document {
    name: string;
    type: AssetType;
    code?: string; // Templates, community videos and generated videos will have it, other videos (uploaded) or audio or text objects will not have it
    origin: AssetOrigin;
    url: string;
    thumbnail: string;
    duration?: number;
    width?: number;
    height?: number;
    bytes: number;
    metadata: Record<string, any>;
    projectId: Types.ObjectId;
    isOnTimeline: Boolean;
    // Optional reference to original template (when origin is TEMPLATE)
    originalTemplateId?: Types.ObjectId;
}

const AssetSchema = new Schema<IAsset>({
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(AssetType), required: true },
    origin: {type: String, enum: Object.values(AssetOrigin), required: true, default: AssetOrigin.GENERATED_VIDEO},
    url: { type: String, required: true },
    thumbnail: {type: String, required: true, default: ""},
    duration: { type: Number },
    width: { type: Number },
    height: { type: Number },
    bytes: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    isOnTimeline: {type: Boolean, default:false},
    // Reference to original template when asset is created from template
    originalTemplateId: { type: Schema.Types.ObjectId, ref: 'Template' }
}, { timestamps: true });

// Index for efficient querying by project and origin
AssetSchema.index({ projectId: 1, origin: 1 });

const Asset: Model<IAsset> = model<IAsset>('Asset', AssetSchema);
export default Asset;