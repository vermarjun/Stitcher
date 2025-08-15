// models/ApiKey.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  service: 'openai' | 'anthropic' | 'cohere' | 'mistral' | 'gemini'; // or any other services you support
  weight: number; // Higher weight = used for heavier tasks
  isActive: boolean;
  apicalls: number; //number of api calls that have been made for this api
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    key: { type: String, required: true },
    service: { type: String, required: true, enum: ['openai', 'anthropic', 'cohere', 'mistral', 'gemini'] },
    weight: { type: Number, required: true, default: 1, min: 1, max: 10 },
    apicalls: {type: Number, required: true, default:0},
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

