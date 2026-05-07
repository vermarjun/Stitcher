/**
 * Resolve per-role LLM configs for a video generation job.
 *
 * Priority:
 *   1. Caller-supplied overrides (already-resolved partial config)
 *   2. User's stored API keys (decrypted via getDecryptedKey())
 *   3. Environment defaults — provider openrouter, no apiKeyOverride so the
 *      agent service falls back to its own env-level keys.
 *
 * Design: never throws. If anything goes wrong reading the database, fall back
 * silently to the env defaults.  The job should still run — just using shared
 * default keys instead of the user's BYOK keys.
 *
 * Note: apiKeyOverride is intentionally omitted from DEFAULT_MODEL_CONFIG so
 * the agent service applies its own default key; no secrets are hardcoded here.
 */

import ApiKey from "../model/userapikeys.model";
import type { LlmRoleConfig } from "../services/agentClient";
import type { ResolvedModelConfig } from "./types";
import logger from "../util/logger.util";

// ─── Env defaults ─────────────────────────────────────────────────────────────

const DEFAULT_MODEL_CONFIG: ResolvedModelConfig = {
    // Planner and coder get a smarter model; it does heavy reasoning.
    planner: {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4-6",
    },
    coder: {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4-6",
    },
    // Debugger only needs to fix small errors; Haiku is faster and cheaper.
    debugger: {
        provider: "openrouter",
        model: "anthropic/claude-haiku-4-5",
    },
    // Validator is optional; the agent service decides whether to use it.
    validator: {
        provider: "openrouter",
        model: "anthropic/claude-haiku-4-5",
    },
};

// Map agentId values stored in the DB to their role in ResolvedModelConfig
const AGENT_ID_TO_ROLE: Record<string, keyof ResolvedModelConfig> = {
    planner: "planner",
    coder: "coder",
    debugger: "debugger",
    reviewer: "validator", // legacy name in DB schema
    optimizer: "validator",
};

function buildRoleConfig(
    keyValue: string,
    baseUrl: string,
    modelName: string
): LlmRoleConfig {
    return {
        provider: "openrouter",
        model: modelName,
        apiKeyOverride: keyValue,
        baseUrlOverride: baseUrl,
    };
}

export async function resolveModelConfig(
    userId: string,
    overrides?: Partial<ResolvedModelConfig>
): Promise<ResolvedModelConfig> {
    // Start from env defaults
    const resolved: ResolvedModelConfig = { ...DEFAULT_MODEL_CONFIG };

    try {
        const userKeys = await ApiKey.find({ userId, isActive: true }).lean<
            Array<{ agentId: string; keyValue: string; baseUrl: string; modelName: string; getDecryptedKey?: () => string }>
        >();

        for (const key of userKeys) {
            const role = AGENT_ID_TO_ROLE[key.agentId];
            if (!role) continue;

            // getDecryptedKey is an instance method and won't survive .lean();
            // use the standalone decrypt via require to avoid circular imports.
            // We already trust the schema pre-save encrypts keyValue, so decrypt here.
            let plainKey: string;
            try {
                // Dynamic require avoids importing at top level which would trigger
                // config validation at module load time if used in tests.
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { decrypt } = require("../util/crypto.util") as { decrypt: (s: string) => string };
                plainKey = decrypt(key.keyValue);
            } catch {
                // If decryption fails, skip this key and fall back to default
                logger.warn({ message: "resolveModelConfig: failed to decrypt key", userId, agentId: key.agentId });
                continue;
            }

            resolved[role] = buildRoleConfig(plainKey, key.baseUrl, key.modelName);
        }
    } catch (err) {
        // DB read failure — log and continue with defaults
        logger.warn({ message: "resolveModelConfig: DB read failed, using defaults", userId, error: String(err) });
    }

    // Apply any caller-supplied overrides on top
    if (overrides) {
        if (overrides.planner) resolved.planner = overrides.planner;
        if (overrides.coder) resolved.coder = overrides.coder;
        if (overrides.debugger) resolved.debugger = overrides.debugger;
        if (overrides.validator) resolved.validator = overrides.validator;
    }

    return resolved;
}
