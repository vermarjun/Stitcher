import { Schema, Document, Types, Model, model } from "mongoose";

// A shared/exported video. The shareId is the opaque token that appears in the
// public Stitcher share URL (/v/:shareId) so the underlying Cloudinary URL is
// never exposed directly in the shared link.
export interface ISharedVideo extends Document {
  shareId: string;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSec: number;
  projectName?: string;
  views: number;
  createdAt: Date;
}

const SharedVideoSchema = new Schema<ISharedVideo>({
  shareId: { type: String, required: true, unique: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: "" },
  durationSec: { type: Number, default: 0 },
  projectName: { type: String, default: "" },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const SharedVideo: Model<ISharedVideo> = model<ISharedVideo>("SharedVideo", SharedVideoSchema);
export default SharedVideo;
