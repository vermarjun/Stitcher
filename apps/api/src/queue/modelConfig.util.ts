/**
 * Resolve per-role LLM configs for a video generation job.
 *
 * Priority:
 *   1. Caller-supplied overrides (already-resolved partial config)
 *   2. User's stored API keys (decrypted via getDecryptedKey())
 *   3. Environment defaults — provider opencodego, no apiKey so the
 *      agent service falls back to its own OPENCODE_GO_API_KEY env var.
 *
 * Design: never throws. If anything goes wrong reading the database, fall back
 * silently to the env defaults.  The job should still run — just using shared
 * default keys instead of the user's BYOK keys.
 *
 * Note: apiKey is intentionally omitted from DEFAULT_MODEL_CONFIG so the agent
 * service applies its own default key; no secrets are hardcoded here. The field
 * names here (apiKey / baseURL) match exactly what the agent service's
 * ModelConfigSchema accepts and what its model factory's getModel() reads, so
 * a user's BYOK key flows end-to-end to the provider.
 */

import ApiKey from "../model/userapikeys.model";
import type { LlmRoleConfig } from "../services/agentClient";
import type { ResolvedModelConfig } from "./types";
import logger from "../util/logger.util";
import { decrypt } from "../util/crypto.util";

// ─── Env defaults ─────────────────────────────────────────────────────────────

const DEFAULT_MODEL_CONFIG: ResolvedModelConfig = {
    // OpenCode Go is the canonical LLM backend for this project.
    // MUST be a tool-capable model: the agent service wraps every role in
    // createReactAgent({llm, tools}), which sends tool_choice on each call.
    // OpenCode's DeepSeek/MiniMax/Qwen run in thinking mode and reject
    // tool_choice ("Thinking mode does not support this tool_choice") AND put
    // their answer in `reasoning` (empty `content`) — so they break the agent
    // two ways. glm-5.1 supports tools and populates content. (kimi-k2.5 also
    // works.) Per-user BYOK keys override this when present.
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
        apiKey: keyValue,
        baseURL: baseUrl,
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

/**
 * Decide whether a resolved model config is funded by the user's OWN keys for
 * the role(s) that will actually be billed by the LLM provider.
 *
 * Used by the generation/edit workers to grant a credit-exhaust path: a user
 * with zero credits may keep running ONLY when they supplied their own keys
 * (BYOT). We must be conservative — never hand out free shared-key generations.
 *
 * A role counts as user-funded only when its config carries a non-empty
 * `apiKey` (the field the agent service actually consumes). The env defaults
 * deliberately omit `apiKey`, so the shared OPENCODE_GO_API_KEY path returns
 * false here and continues to require credits.
 *
 * The coder role is the primary cost driver and is invoked in BOTH pipelines
 * (generation per-scene, edit once), so it is the gate. If the coder is on the
 * user's own key, the run will not consume the shared default key for the
 * billable work, and we allow it without decrementing credits.
 */
export function hasOwnKeys(config: ResolvedModelConfig): boolean {
    const key = config.coder?.apiKey;
    return typeof key === "string" && key.trim().length > 0;
}
