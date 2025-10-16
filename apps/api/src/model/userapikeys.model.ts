import { Document, Schema, model, Types } from 'mongoose';

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  agentId: string;
  agentName: string;
  keyValue: string;
  baseUrl: string;
  modelName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  agentId: {
    type: String,
    required: true,
    enum: ['general', 'coder', 'reviewer', 'debugger', 'planner', 'optimizer']
  },
  agentName: {
    type: String,
    required: true
  },
  keyValue: {
    type: String,
    required: true
  },
  baseUrl: {
    type: String,
    required: true
  },
  modelName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Compound index to ensure one key per agent per user
ApiKeySchema.index({ userId: 1, agentId: 1 }, { unique: true });

export default model<IApiKey>('ApiKey', ApiKeySchema);