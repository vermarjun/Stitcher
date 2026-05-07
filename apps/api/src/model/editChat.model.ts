import {Schema, Document, Model, model} from "mongoose";
// ITimeline import removed — was unused

// Interface for individual messages in a chat
export interface IChatMessage {
    role: string; //'user' | 'assistant'
    content: any;
    timestamp: Date;
    timelineObject?: any; // Har ek message ke liye unique timeline Object banega. STORE IT TO PROVIDE ROLL BACK FEATURE AFTER EACH PROMPT TO EDIT THE TIMELINE
}

// Interface representing a Chat document in MongoDB
export interface IChat extends Document {
    messages: IChatMessage[];
}

// Chat Message Schema
const ChatMessageSchema = new Schema<IChatMessage>({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
    timelineObject: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

// Chat Schema
const ChatSchema = new Schema<IChat>({
    messages: [ChatMessageSchema],
}, { timestamps: true });

const EditChat: Model<IChat> = model<IChat>('EditChat', ChatSchema);
export default EditChat;