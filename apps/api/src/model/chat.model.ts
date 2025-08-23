import {Schema, Document, Types, Model, model} from "mongoose";

// Interface for individual messages in a chat
export interface IChatMessage {
    role: string; //'user' | 'assistant'
    content: any;
    timestamp: Date;
    code?: string; // Generated code for assistant messages
    metadata?: Record<string, any>;
}

// Interface representing a Chat document in MongoDB
export interface IChat extends Document {
    name: string; // Auto-generated or user-provided chat name
    type: string;
    messages: IChatMessage[];
    projectId: Types.ObjectId;
    assetId?: Types.ObjectId; // Current video asset for this chat
    compiled: boolean; // Whether current asset is compiled
    summary?: string; // purani sari chats ki summary jo ki as context LLM ko pass hogi
}

// Chat Message Schema
const ChatMessageSchema = new Schema<IChatMessage>({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now },
    code: { type: String }, // Only for assistant messages
    metadata: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

// Chat Schema
const ChatSchema = new Schema<IChat>({
    name: { type: String, required: true },
    type: { type: String, enum: ['generate', 'edit'], required: true },
    messages: [ChatMessageSchema],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    compiled: { type: Boolean, default: false },
    summary: { type: String }
}, { timestamps: true });

// Auto-generate chat name from first user message if not provided
ChatSchema.pre('save', function(next) {
    if (this.isNew && !this.name && this.messages.length > 0) {
        const firstUserMessage = this.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
            // Take first 50 chars of first user message as name
            this.name = firstUserMessage.content.substring(0, 50).trim() + '...';
        }
    }
    next();
});

// Create the Chat model
const Chat: Model<IChat> = model<IChat>('Chat', ChatSchema);
export default Chat;