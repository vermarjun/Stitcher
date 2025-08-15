import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Scene document in MongoDB
export interface IScene extends Document {
    name: string;
    prompts: Types.ObjectId[];
    compiled: boolean;
    assetId?: Types.ObjectId; // Generated asset from prompts
    projectId: Types.ObjectId;
}

// Scene Schema
const SceneSchema = new Schema<IScene>({
    name: { type: String, required: true },
    prompts: [{ type: Schema.Types.ObjectId, ref: 'Prompt' }],
    compiled: { type: Boolean, default: false },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true }
}, { timestamps: true });

// Create the Scene model
const Scene: Model<IScene> = model<IScene>('Scene', SceneSchema);

export default Scene;