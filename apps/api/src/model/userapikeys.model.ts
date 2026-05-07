import { Document, Schema, model, Types } from 'mongoose';
import { encrypt, decrypt, isEncrypted } from '../util/crypto.util';

export interface IApiKey extends Document {
  userId: Types.ObjectId;
  agentId: string;
  agentName: string;
  /** Stored encrypted on disk; use getDecryptedKey() to read plaintext. */
  keyValue: string;
  baseUrl: string;
  modelName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Returns the decrypted plaintext API key. */
  getDecryptedKey(): string;
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

// ─── Pre-save: encrypt keyValue if not already encrypted ─────────────────────
ApiKeySchema.pre('save', function (next) {
  if (this.isModified('keyValue') && !isEncrypted(this.keyValue)) {
    this.keyValue = encrypt(this.keyValue);
  }
  next();
});

// ─── Instance method: return decrypted plaintext ──────────────────────────────
ApiKeySchema.methods.getDecryptedKey = function (this: IApiKey): string {
  return decrypt(this.keyValue);
};

export default model<IApiKey>('ApiKey', ApiKeySchema);
