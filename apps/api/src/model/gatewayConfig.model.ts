/**
 * GatewayConfig — persists subscription tokens for the LLM gateway proxy.
 * One document per provider (opencode-go, codex).
 * Tokens are AES-256-GCM encrypted via the shared crypto.util.
 */

import { Schema, model, Document } from 'mongoose';

export type GatewayProvider = 'opencode-go' | 'codex';

export const GATEWAY_PROVIDERS: GatewayProvider[] = ['opencode-go', 'codex'];

export interface IGatewayConfig extends Document {
    provider: GatewayProvider;
    /** AES-256-GCM encrypted access token / API key */
    encryptedToken: string;
    /** Optional OAuth refresh token (encrypted) */
    encryptedRefreshToken?: string;
    /** Token expiry hint (informational; not enforced automatically) */
    expiresAt?: Date;
    /** ChatGPT account id (UUID) for the chatgpt-account-id header. Not secret. */
    accountId?: string;
    updatedAt: Date;
    updatedBy?: string | null;
}

const GatewayConfigSchema = new Schema<IGatewayConfig>(
    {
        provider: { type: String, required: true, unique: true },
        encryptedToken: { type: String, required: true },
        encryptedRefreshToken: { type: String },
        expiresAt: { type: Date },
        accountId: { type: String },
        updatedBy: { type: String, default: null },
    },
    { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

export default model<IGatewayConfig>('GatewayConfig', GatewayConfigSchema);
