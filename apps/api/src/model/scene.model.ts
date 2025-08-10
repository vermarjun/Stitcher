import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Project document in MongoDB
export interface IScene extends Document {
    name: String,
    prompts?: Types.ObjectId[],
    compiled: Boolean
}

// Project Schema
const SceneSchema = new Schema<IScene>({
    name: { type: String, required: true },
    prompts: [{ type: Schema.Types.ObjectId, ref: 'Prompt' }],
    compiled: { type: Boolean, default: false },
}, { timestamps: true });

// Create the Scene model
const Scene: Model<IScene> = model<IScene>('Scene', SceneSchema);

export default Scene;