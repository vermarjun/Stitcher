import {Schema, Document, Types, Model, model} from "mongoose";

// Interface for individual messages in a chat
export interface IGenerateChatMessage {
    role: string; //'user' | 'assistant'
    content: any; //User's message and LLM's textual response
    timestamp: Date; 
    code?: string; // Code that was generate for this prompt
    assetId? : Types.ObjectId; // Unique asset for every chat, this asset is updated always for new message in the same chat 
    projectDescription: String;
}

// Interface representing a Chat document in MongoDB
export interface IGenerateChat extends Document {
    title: string; // Auto-generated from the first prompt
    messages: IGenerateChatMessage[];
    projectId: Types.ObjectId; // Gnerate chat's projectId
}

// Chat Message Schema
const ChatMessageSchema = new Schema<IGenerateChatMessage>({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: Schema.Types.Mixed, required: true },
    code: { type: String }, // Only for assistant messages
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    timestamp: { type: Date, default: Date.now },
    projectDescription: {type: String, default: ""}
}, { _id: false });

// Chat Schema
const GenerateChatSchema = new Schema<IGenerateChat>({
    title: { type: String, required: true },
    messages: [ChatMessageSchema],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
}, { timestamps: true });

// Auto-generate chat name from first user message if not provided
// GenerateChatSchema.pre('save', function(next) {
//     if (this.isNew && !this.name && this.messages.length > 0) {
//         const firstUserMessage = this.messages.find(msg => msg.role === 'user');
//         if (firstUserMessage) {
//             // Take first 50 chars of first user message as name
//             this.name = firstUserMessage.content.substring(0, 50).trim() + '...';
//         }
//     }
//     next();
// });

// Create the Chat model
const GenerateChat: Model<IGenerateChat> = model<IGenerateChat>('GenerateChat', GenerateChatSchema);
export default GenerateChat;