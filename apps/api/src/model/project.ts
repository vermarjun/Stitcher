import {Schema, Document, Types, ObjectId, Model, model} from "mongoose";

// Interface representing a Project document in MongoDB
export interface IProject extends Document {
    name: String,
    scenes?: Types.ObjectId,
    duration: Number,
    bytes: Number,
    compiled: Boolean
    playback_url : String
}

// Project Schema
const ProjectSchema = new Schema<IProject>({
    name: { type: String, required: true },
    scenes: [{ type: Schema.Types.ObjectId, ref: 'Scene' }],
    duration: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    compiled: { type: Boolean, default: false },
    playback_url: { type: String, default: "" }
}, { timestamps: true });


// Create the Project model
const Project: Model<IProject> = model<IProject>('Project', ProjectSchema);

export default Project;