/**
 * serviceConfig.seed.ts — idempotent boot-time seed for ServiceConfig.
 *
 * For every (service × tier) combination, creates a document from env defaults
 * if one doesn't already exist. Never overwrites existing rows.
 *
 * Call seedServiceConfigs() after Mongo connects (see database.util.ts).
 */

import { config } from "../config";
import ServiceConfig, { SERVICE_KEYS, TIER_KEYS } from "../model/serviceConfig.model";
import { encrypt, isEncrypted } from "../util/crypto.util";
import logger from "../util/logger.util";

// ─── Env-sourced default seed values per service ──────────────────────────────

interface SeedRow {
    provider: string;
    apiKey:   string;
    baseURL:  string | null;
    modelId:  string | null;
    params:   Record<string, unknown>;
}

function buildSeedDefaults(): Record<string, SeedRow> {
    return {
        coder: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            modelId:  config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { maxTokens: 8000, enable_thinking: false, temperature: 0.2 },
        },
        debugger: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            modelId:  config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { maxTokens: 8000, enable_thinking: false, temperature: 0.2 },
        },
        query_transform: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            modelId:  config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { maxTokens: 4096, temperature: 0.1 },
        },
        embedder: {
            provider: "ollama",
            apiKey:   "",
            baseURL:  (config as unknown as Record<string, string>)["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
            modelId:  "bge-m3",
            params:   {},
        },
        tts: {
            provider: config.TTS_PROVIDER || "gtts",
            apiKey:   config.AZURE_SPEECH_KEY  ?? "",
            baseURL:  null,
            modelId:  null,
            params:   {
                region: config.AZURE_SPEECH_REGION ?? "eastus",
                voice:  config.DEFAULT_VOICEOVER_VOICE ?? "en-US-AvaNeural",
            },
        },
    };
}

/**
 * Idempotent seed: for every (service × tier), insert a default row if none
 * exists.  Uses bulkWrite with upsert:false semantics via $setOnInsert so
 * existing rows are never mutated.
 */
export async function seedServiceConfigs(): Promise<void> {
    try {
        const defaults = buildSeedDefaults();
        const ops = [];

        for (const service of SERVICE_KEYS) {
            const row = defaults[service];
            // Encrypt the apiKey for insertion (pre-save hook runs on .save()
            // but not on bulkWrite — we encrypt manually here).
            const encryptedKey =
                row.apiKey && !isEncrypted(row.apiKey)
                    ? encrypt(row.apiKey)
                    : row.apiKey;

            for (const tier of TIER_KEYS) {
                ops.push({
                    updateOne: {
                        filter: { service, tier },
                        update: {
                            $setOnInsert: {
                                service,
                                tier,
                                provider:  row.provider,
                                apiKey:    encryptedKey,
                                baseURL:   row.baseURL,
                                modelId:   row.modelId,
                                params:    row.params,
                                enabled:   true,
                                updatedBy: null,
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }

        const result = await ServiceConfig.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount ?? 0;
        if (inserted > 0) {
            logger.info({
                message: `[serviceConfig seed] inserted ${inserted} new rows (${SERVICE_KEYS.length} services × ${TIER_KEYS.length} tiers = ${SERVICE_KEYS.length * TIER_KEYS.length} total)`,
            });
        } else {
            logger.debug({ message: "[serviceConfig seed] all rows already exist — nothing to insert" });
        }
    } catch (err) {
        // Seed failure must never crash the server — best-effort.
        logger.error({
            message: "[serviceConfig seed] failed (non-fatal, env defaults still serve)",
            error: String(err),
        });
    }
}
