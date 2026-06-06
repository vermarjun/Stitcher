import {Schema, Document, Model, model, Types} from "mongoose";

export interface IChatMessage {
    role: string;
    content: any;
    timestamp: Date;
    timelineObject?: any;
}

export interface IChat extends Document {
    projectId?: Types.ObjectId;
    userId?: Types.ObjectId;
    messages: IChatMessage[];
}

const ChatMessageSchema = new Schema<IChatMessage>({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
    timelineObject: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const ChatSchema = new Schema<IChat>({
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    messages: [ChatMessageSchema],
}, { timestamps: true });

ChatSchema.index({ projectId: 1, userId: 1 });

const EditChat: Model<IChat> = model<IChat>('EditChat', ChatSchema);
export default EditChat;
