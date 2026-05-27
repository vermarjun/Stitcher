/**
 * Resolve per-role LLM configs for a video generation job.
 *
 * Priority:
 *   1. Caller-supplied overrides (already-resolved partial config)
 *   2. User's stored API keys (decrypted via getDecryptedKey())
 *   3. Environment defaults — provider opencodego, no apiKeyOverride so the
 *      agent service falls back to its own OPENCODE_GO_API_KEY env var.
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
import { decrypt } from "../util/crypto.util";

// ─── Env defaults ─────────────────────────────────────────────────────────────

const DEFAULT_MODEL_CONFIG: ResolvedModelConfig = {
    // OpenCode Go is the canonical LLM backend for this project.
    // glm-5.1 is a good default for planner/coder/debugger/validator — fast,
    // OpenAI-completions compatible, and the OPENCODE_GO_API_KEY single key
    // covers all roles. Per-user BYOK keys override this when present.
    planner: {
        provider: "opencodego",
        model: "glm-5.1",
    },
    coder: {
        provider: "opencodego",
        model: "glm-5.1",
    },
    debugger: {
        provider: "opencodego",
        model: "glm-5.1",
    },
    validator: {
        provider: "opencodego",
        model: "glm-5.1",
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
        // User-supplied keys still flow through openrouter — the UI accepts
        // OpenAI/Anthropic/Cohere/Mistral/Gemini keys, and OpenRouter is the
        // unified gateway that accepts all of them.
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
