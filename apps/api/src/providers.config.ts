/**
 * Provider configuration, resolved from environment variables only.
 *
 * One default LLM (LLM_PROVIDER / LLM_MODEL / LLM_API_KEY / LLM_BASE_URL) is
 * used for every role. A role can override any field with its own prefix:
 * CODER_*, DEBUGGER_*, QUERY_TRANSFORM_*. A role override only inherits the
 * model, key and base URL from LLM_* when it uses the same provider, because
 * a key for one provider is useless for another.
 *
 * The shapes returned here are what the agent service (modelConfig) and the
 * RAG service (providerConfig) accept per request. Do not change them without
 * changing those services.
 */

import { config as appConfig } from "./config";
import type { AppConfig } from "./config";
import type { LlmRoleConfig } from "./services/agentClient";

export type LlmRole = "coder" | "debugger" | "query_transform";

/** The subset of the app config this module reads. Lets tests pass plain objects. */
export type ProviderEnv = Partial<
    Pick<
        AppConfig,
        | "LLM_PROVIDER" | "LLM_MODEL" | "LLM_API_KEY" | "LLM_BASE_URL"
        | "CODER_PROVIDER" | "CODER_MODEL" | "CODER_API_KEY" | "CODER_BASE_URL"
        | "DEBUGGER_PROVIDER" | "DEBUGGER_MODEL" | "DEBUGGER_API_KEY" | "DEBUGGER_BASE_URL"
        | "QUERY_TRANSFORM_PROVIDER" | "QUERY_TRANSFORM_MODEL" | "QUERY_TRANSFORM_API_KEY" | "QUERY_TRANSFORM_BASE_URL"
        | "EMBEDDER_PROVIDER" | "EMBEDDER_MODEL" | "EMBEDDER_API_KEY" | "EMBEDDER_BASE_URL"
        | "TTS_PROVIDER" | "AZURE_SPEECH_KEY" | "AZURE_SPEECH_REGION" | "DEFAULT_VOICEOVER_VOICE"
    >
>;

/** Default model per provider. openrouter has none: LLM_MODEL is required there. */
export const DEFAULT_MODELS: Record<string, string | undefined> = {
    openai: "gpt-4.1-mini",
    anthropic: "claude-sonnet-5-5",
    gemini: "gemini-2.5-flash",
    groq: "llama-3.3-70b-versatile",
    ollama: "llama3.1",
    opencodego: "glm-5.1",
    openrouter: undefined,
};

/**
 * OpenAI-compatible base URL per provider. The RAG query transform and the
 * API's own memory-reflection call speak the OpenAI chat-completions protocol,
 * so every provider needs one here. The agent service uses native clients for
 * anthropic and gemini and ignores these.
 */
export const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    openrouter: "https://openrouter.ai/api/v1",
    groq: "https://api.groq.com/openai/v1",
    opencodego: "https://opencode.ai/zen/go/v1",
    ollama: "http://localhost:11434/v1",
};

const norm = (s: string | undefined | null): string | undefined => {
    const t = s?.trim();
    return t ? t : undefined;
};

export interface ResolvedRole {
    provider: string;
    model: string;
    apiKey?: string;
    /** Only set when the operator configured it (or ollama, which has a local default). */
    baseURL?: string;
}

function resolveRoleBase(env: ProviderEnv, role: LlmRole | null): ResolvedRole {
    const prefix = role === "coder" ? "CODER" : role === "debugger" ? "DEBUGGER" : role === "query_transform" ? "QUERY_TRANSFORM" : null;
    const get = (suffix: string): string | undefined =>
        prefix ? norm((env as unknown as Record<string, string | undefined>)[`${prefix}_${suffix}`]) : undefined;

    const defaultProvider = (norm(env.LLM_PROVIDER) ?? "openai").toLowerCase();
    const provider = (get("PROVIDER") ?? defaultProvider).toLowerCase();
    const sameAsDefault = provider === defaultProvider;

    const model = get("MODEL") ?? (sameAsDefault ? norm(env.LLM_MODEL) : undefined) ?? DEFAULT_MODELS[provider];
    if (!model) {
        const which = prefix && !sameAsDefault ? `${prefix}_MODEL` : "LLM_MODEL";
        throw new Error(
            `No model configured for provider "${provider}". Set ${which} (this provider has no built-in default).`
        );
    }

    const apiKey = get("API_KEY") ?? (sameAsDefault ? norm(env.LLM_API_KEY) : undefined);
    let baseURL = get("BASE_URL") ?? (sameAsDefault ? norm(env.LLM_BASE_URL) : undefined);
    if (!baseURL && provider === "ollama") baseURL = OPENAI_COMPAT_BASE_URLS.ollama;

    return { provider, model, ...(apiKey ? { apiKey } : {}), ...(baseURL ? { baseURL } : {}) };
}

/** Per-role LLM config in the exact shape the agent service accepts. */
export function resolveAgentRole(role: "coder" | "debugger", env: ProviderEnv = appConfig): LlmRoleConfig {
    const r = resolveRoleBase(env, role);
    return {
        provider: r.provider,
        model: r.model,
        ...(r.apiKey ? { apiKey: r.apiKey } : {}),
        ...(r.baseURL ? { baseURL: r.baseURL } : {}),
        // The agent factory reads maxTokens and temperature from params.
        params: { maxTokens: 8000, temperature: 0.2 },
    };
}

/** The default LLM, for roles that have no override of their own (planner, validator). */
export function resolveDefaultAgentRole(env: ProviderEnv = appConfig): LlmRoleConfig {
    const r = resolveRoleBase(env, null);
    return {
        provider: r.provider,
        model: r.model,
        ...(r.apiKey ? { apiKey: r.apiKey } : {}),
        ...(r.baseURL ? { baseURL: r.baseURL } : {}),
        params: { maxTokens: 8000, temperature: 0.2 },
    };
}

export interface ResolvedModelConfig {
    planner: LlmRoleConfig;
    coder: LlmRoleConfig;
    debugger: LlmRoleConfig;
    validator: LlmRoleConfig;
}

/** Per-role agent configs for one job. Planner and validator use the default LLM. */
export function resolveModelConfig(env: ProviderEnv = appConfig): ResolvedModelConfig {
    return {
        planner: resolveDefaultAgentRole(env),
        coder: resolveAgentRole("coder", env),
        debugger: resolveAgentRole("debugger", env),
        validator: resolveDefaultAgentRole(env),
    };
}

export interface RagQueryTransformConfig {
    provider: string;
    apiKey: string;
    baseURL: string | null;
    model: string | null;
    params: Record<string, unknown>;
}

export interface RagEmbedderConfig {
    provider: string;
    apiKey: string;
    baseURL: string | null;
    model: string | null;
    params: Record<string, unknown>;
}

/** Query-transform config for the RAG service (OpenAI-compatible endpoint). */
export function resolveQueryTransform(env: ProviderEnv = appConfig): RagQueryTransformConfig {
    const r = resolveRoleBase(env, "query_transform");
    const params: Record<string, unknown> = { max_tokens: 4096, temperature: 0.1 };
    // Only OpenCode Go models need thinking switched off for this call.
    if (r.provider === "opencodego") params.thinking = { type: "disabled" };
    return {
        provider: r.provider,
        apiKey: r.apiKey ?? "",
        baseURL: r.baseURL ?? OPENAI_COMPAT_BASE_URLS[r.provider] ?? null,
        model: r.model,
        params,
    };
}

const DEFAULT_EMBEDDER_MODELS: Record<string, string> = {
    gemini: "gemini-embedding-001",
    openai: "text-embedding-3-small",
    ollama: "bge-m3",
};

/**
 * Embedder override for the RAG service. Returns undefined unless
 * EMBEDDER_PROVIDER is set, so the RAG service keeps using its own embedder
 * (which must match the vectors in its index) by default.
 */
export function resolveEmbedder(env: ProviderEnv = appConfig): RagEmbedderConfig | undefined {
    const provider = norm(env.EMBEDDER_PROVIDER)?.toLowerCase();
    if (!provider) return undefined;
    let baseURL = norm(env.EMBEDDER_BASE_URL) ?? null;
    if (!baseURL) {
        // Ollama's embed endpoint is /api/embed on the bare host, not /v1.
        baseURL = provider === "ollama" ? "http://localhost:11434" : provider === "gemini" ? null : (OPENAI_COMPAT_BASE_URLS[provider] ?? null);
    }
    return {
        provider,
        apiKey: norm(env.EMBEDDER_API_KEY) ?? "",
        baseURL,
        model: norm(env.EMBEDDER_MODEL) ?? DEFAULT_EMBEDDER_MODELS[provider] ?? null,
        params: {},
    };
}

/** providerConfig body for the RAG /enhance call. */
export function resolveRagProviderConfig(env: ProviderEnv = appConfig): {
    queryTransform: RagQueryTransformConfig;
    embedder?: RagEmbedderConfig;
} {
    const embedder = resolveEmbedder(env);
    return { queryTransform: resolveQueryTransform(env), ...(embedder ? { embedder } : {}) };
}

export interface ResolvedTts {
    provider: string;
    apiKey: string;
    baseURL: string | null;
    params: { region?: string; voice?: string };
}

export function resolveTts(env: ProviderEnv = appConfig): ResolvedTts {
    return {
        provider: (norm(env.TTS_PROVIDER) ?? "gtts").toLowerCase(),
        apiKey: norm(env.AZURE_SPEECH_KEY) ?? "",
        baseURL: null,
        params: {
            region: norm(env.AZURE_SPEECH_REGION) ?? "eastus",
            voice: norm(env.DEFAULT_VOICEOVER_VOICE) ?? "en-US-AvaNeural",
        },
    };
}

export interface DirectLlm {
    baseUrl: string;
    apiKey: string;
    model: string;
}

/** Default LLM as an OpenAI-compatible endpoint, for the API's own small calls (memory reflection). */
export function resolveDirectLlm(env: ProviderEnv = appConfig): DirectLlm | null {
    const r = resolveRoleBase(env, null);
    const baseUrl = r.baseURL ?? OPENAI_COMPAT_BASE_URLS[r.provider];
    if (!baseUrl) return null;
    // A hosted provider without a key cannot work; ollama does not need one.
    if (!r.apiKey && r.provider !== "ollama") return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey: r.apiKey ?? "ollama", model: r.model };
}

/** Human-readable problems with the LLM settings, for a boot-time warning. Empty when fine. */
export function providerWarnings(env: ProviderEnv = appConfig): string[] {
    const out: string[] = [];
    for (const role of [null, "coder", "debugger", "query_transform"] as const) {
        try {
            const r = resolveRoleBase(env, role);
            if (!r.apiKey && r.provider !== "ollama") {
                out.push(`${role ? role : "default"} LLM (${r.provider}) has no API key; the agent service will use its own env key if it has one.`);
            }
        } catch (err) {
            out.push((err as Error).message);
        }
    }
    return Array.from(new Set(out));
}
