/**
 * ServiceConfig — per-(service × tier) runtime provider configuration.
 *
 * One doc per (service, tier) pair.  Unique compound index enforced.
 * apiKey is stored ENCRYPTED at rest via the same BYOK AES-256-GCM util
 * used by the ApiKey (BYOK) model.  Never log or return the plaintext.
 *
 * NOTE on the `modelId` naming:
 *   Mongoose's Document interface already has a `.model()` method, so naming
 *   the field "model" creates a type collision. The TS interface uses `modelId`
 *   while the Mongoose schema maps it to the DB field name "model" via `alias`.
 *   External code should access it as `doc.modelId` (TS-typed) or via lean()
 *   queries where the raw field name "model" is used directly.
 */

import { Document, Schema, Model, Types, model } from "mongoose";
import { encrypt, decrypt, isEncrypted } from "../util/crypto.util";

// ─── Allowed enum values ──────────────────────────────────────────────────────

export const SERVICE_KEYS = ["coder", "debugger", "query_transform", "embedder", "tts"] as const;
export const TIER_KEYS    = ["free", "plus", "master"] as const;

export type ServiceKey = typeof SERVICE_KEYS[number];
export type TierKey    = typeof TIER_KEYS[number];

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IServiceConfig extends Document {
    service:   ServiceKey;
    tier:      TierKey;
    /** Provider identifier, e.g. "opencodego" | "openai" | "azure" | "ollama" */
    provider:  string;
    /** AES-256-GCM encrypted at rest.  Use getDecryptedApiKey() for plaintext. */
    apiKey:    string;
    /** Endpoint override; null means use the provider's default. */
    baseURL:   string | null;
    /**
     * Model id (LLM/embedder). For tts the voice lives in params, not here.
     * DB field name: "model". TS alias: "modelId" to avoid collision with
     * Mongoose Document.model() method.
     */
    modelId:   string | null;
    /** Freeform provider params: temperature, maxTokens, enable_thinking, region, voice, … */
    params:    Record<string, unknown>;
    /**
     * Optional fallback provider. When the PRIMARY provider above errors or
     * returns empty output, the worker retries the same call with this config.
     * Same field shape as the primary (apiKey encrypted at rest). Only used
     * when `fallback.enabled === true` AND `fallback.provider` is non-empty.
     */
    fallback?: IServiceConfigFallback;
    enabled:   boolean;
    updatedAt: Date;
    updatedBy: Types.ObjectId | null;
    /** Returns decrypted plaintext apiKey (empty string when no key stored). */
    getDecryptedApiKey(): string;
}

/** Fallback provider config — mirrors the primary fields (no nested fallback). */
export interface IServiceConfigFallback {
    /** When true, the worker will use this config if the primary fails. */
    enabled:  boolean;
    provider: string;
    /** AES-256-GCM encrypted at rest (same as the primary apiKey). */
    apiKey:   string;
    baseURL:  string | null;
    modelId:  string | null;
    params:   Record<string, unknown>;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ServiceConfigSchema = new Schema<IServiceConfig>(
    {
        service: {
            type: String,
            required: true,
            enum: SERVICE_KEYS,
        },
        tier: {
            type: String,
            required: true,
            enum: TIER_KEYS,
        },
        provider: {
            type: String,
            required: true,
            default: "",
        },
        apiKey: {
            type: String,
            default: "",
        },
        baseURL: {
            type: String,
            default: null,
        },
        // DB field is "model"; TS accessor is "modelId" (alias below)
        modelId: {
            type: String,
            default: null,
        },
        params: {
            type: Schema.Types.Mixed,
            default: {},
        },
        // Optional fallback provider (same shape as primary, no nested fallback).
        // _id:false keeps it a plain embedded object. apiKey encrypted at rest.
        fallback: {
            type: new Schema<IServiceConfigFallback>(
                {
                    enabled:  { type: Boolean, default: false },
                    provider: { type: String, default: "" },
                    apiKey:   { type: String, default: "" },
                    baseURL:  { type: String, default: null },
                    modelId:  { type: String, default: null },
                    params:   { type: Schema.Types.Mixed, default: {} },
                },
                { _id: false }
            ),
            default: undefined,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: { createdAt: false, updatedAt: true },
    }
);

// Unique (service, tier) pair
ServiceConfigSchema.index({ service: 1, tier: 1 }, { unique: true });

// ─── Pre-save: auto-encrypt apiKey if not already encrypted ──────────────────
ServiceConfigSchema.pre("save", function (next) {
    if (this.isModified("apiKey") && this.apiKey && !isEncrypted(this.apiKey)) {
        this.apiKey = encrypt(this.apiKey);
    }
    // Encrypt the fallback apiKey too (defensive — the admin controller also
    // encrypts manually since it uses findOneAndUpdate, which skips this hook).
    if (this.fallback?.apiKey && !isEncrypted(this.fallback.apiKey)) {
        this.fallback.apiKey = encrypt(this.fallback.apiKey);
    }
    next();
});

// ─── Instance helper: decrypt apiKey ─────────────────────────────────────────
ServiceConfigSchema.methods.getDecryptedApiKey = function (
    this: IServiceConfig
): string {
    if (!this.apiKey) return "";
    try {
        return decrypt(this.apiKey);
    } catch {
        return "";
    }
};

// ─── Model ───────────────────────────────────────────────────────────────────

const ServiceConfig: Model<IServiceConfig> = model<IServiceConfig>(
    "ServiceConfig",
    ServiceConfigSchema
);

export default ServiceConfig;
