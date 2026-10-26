import { describe, it, expect } from "vitest";
import {
    resolveAgentRole,
    resolveQueryTransform,
    resolveEmbedder,
    resolveRagProviderConfig,
    resolveTts,
    resolveDirectLlm,
    resolveModelConfig,
    providerWarnings,
} from "../providers.config";

describe("default LLM", () => {
    it("defaults to openai with its default model", () => {
        const c = resolveAgentRole("coder", {});
        expect(c.provider).toBe("openai");
        expect(c.model).toBe("gpt-4.1-mini");
        expect(c.apiKey).toBeUndefined();
        expect(c.baseURL).toBeUndefined();
        expect(c.params).toEqual({ maxTokens: 8000, temperature: 0.2 });
    });

    it("uses LLM_* for every role", () => {
        const env = { LLM_PROVIDER: "anthropic", LLM_MODEL: "claude-x", LLM_API_KEY: "sk-a" };
        for (const role of ["coder", "debugger"] as const) {
            expect(resolveAgentRole(role, env)).toMatchObject({ provider: "anthropic", model: "claude-x", apiKey: "sk-a" });
        }
    });

    it("has a default model for each supported provider except openrouter", () => {
        expect(resolveAgentRole("coder", { LLM_PROVIDER: "gemini" }).model).toBe("gemini-2.5-flash");
        expect(resolveAgentRole("coder", { LLM_PROVIDER: "anthropic" }).model).toMatch(/^claude-/);
        expect(() => resolveAgentRole("coder", { LLM_PROVIDER: "openrouter" })).toThrow(/LLM_MODEL/);
        expect(resolveAgentRole("coder", { LLM_PROVIDER: "openrouter", LLM_MODEL: "x/y" }).model).toBe("x/y");
    });

    it("defaults ollama to the local OpenAI-compatible endpoint", () => {
        const c = resolveAgentRole("coder", { LLM_PROVIDER: "ollama" });
        expect(c.baseURL).toBe("http://localhost:11434/v1");
        expect(c.apiKey).toBeUndefined();
    });

    it("passes LLM_BASE_URL through", () => {
        const c = resolveAgentRole("coder", { LLM_BASE_URL: "http://proxy:9000/v1" });
        expect(c.baseURL).toBe("http://proxy:9000/v1");
    });
});

describe("role overrides", () => {
    const env = {
        LLM_PROVIDER: "openai",
        LLM_MODEL: "gpt-4.1",
        LLM_API_KEY: "sk-openai",
        CODER_MODEL: "gpt-4.1-mini",
        DEBUGGER_PROVIDER: "gemini",
        DEBUGGER_API_KEY: "g-key",
    };

    it("overrides a single field and inherits the rest from the same provider", () => {
        expect(resolveAgentRole("coder", env)).toMatchObject({ provider: "openai", model: "gpt-4.1-mini", apiKey: "sk-openai" });
    });

    it("does not leak the default key or model into a different provider", () => {
        const d = resolveAgentRole("debugger", env);
        expect(d.provider).toBe("gemini");
        expect(d.model).toBe("gemini-2.5-flash");
        expect(d.apiKey).toBe("g-key");

        const noKey = resolveAgentRole("debugger", { ...env, DEBUGGER_API_KEY: undefined });
        expect(noKey.apiKey).toBeUndefined();
    });

    it("resolveModelConfig fills planner and validator from the default LLM", () => {
        const m = resolveModelConfig(env);
        expect(m.planner.model).toBe("gpt-4.1");
        expect(m.validator.model).toBe("gpt-4.1");
        expect(m.coder.model).toBe("gpt-4.1-mini");
        expect(m.debugger.provider).toBe("gemini");
    });
});

describe("RAG provider config", () => {
    it("builds the query transform on an OpenAI-compatible URL", () => {
        const qt = resolveQueryTransform({ LLM_PROVIDER: "openai", LLM_API_KEY: "sk" });
        expect(qt).toEqual({
            provider: "openai",
            apiKey: "sk",
            baseURL: "https://api.openai.com/v1",
            model: "gpt-4.1-mini",
            params: { max_tokens: 4096, temperature: 0.1 },
        });
    });

    it("maps gemini and anthropic to their OpenAI-compatible endpoints", () => {
        expect(resolveQueryTransform({ LLM_PROVIDER: "gemini" }).baseURL).toContain("generativelanguage.googleapis.com");
        expect(resolveQueryTransform({ LLM_PROVIDER: "anthropic" }).baseURL).toBe("https://api.anthropic.com/v1");
    });

    it("sends provider-specific params only for that provider", () => {
        expect(resolveQueryTransform({ LLM_PROVIDER: "opencodego" }).params).toHaveProperty("thinking");
        expect(resolveQueryTransform({ LLM_PROVIDER: "openai" }).params).not.toHaveProperty("thinking");
    });

    it("QUERY_TRANSFORM_* overrides the default", () => {
        const qt = resolveQueryTransform({
            LLM_PROVIDER: "openai",
            LLM_API_KEY: "sk",
            QUERY_TRANSFORM_PROVIDER: "ollama",
            QUERY_TRANSFORM_MODEL: "qwen2.5",
        });
        expect(qt).toMatchObject({ provider: "ollama", model: "qwen2.5", apiKey: "", baseURL: "http://localhost:11434/v1" });
    });

    it("omits the embedder unless EMBEDDER_PROVIDER is set", () => {
        expect(resolveEmbedder({ LLM_PROVIDER: "openai", LLM_API_KEY: "sk" })).toBeUndefined();
        expect("embedder" in resolveRagProviderConfig({})).toBe(false);
    });

    it("builds an embedder override from EMBEDDER_*", () => {
        const e = resolveEmbedder({ EMBEDDER_PROVIDER: "gemini", EMBEDDER_API_KEY: "g" });
        expect(e).toEqual({ provider: "gemini", apiKey: "g", baseURL: null, model: "gemini-embedding-001", params: {} });
        expect(resolveEmbedder({ EMBEDDER_PROVIDER: "ollama" })?.baseURL).toBe("http://localhost:11434");
        expect(resolveEmbedder({ EMBEDDER_PROVIDER: "openai", EMBEDDER_MODEL: "m" })).toMatchObject({
            baseURL: "https://api.openai.com/v1",
            model: "m",
        });
    });
});

describe("TTS", () => {
    it("defaults to gtts with no key", () => {
        expect(resolveTts({})).toMatchObject({ provider: "gtts", apiKey: "" });
    });

    it("reads Azure settings", () => {
        const t = resolveTts({ TTS_PROVIDER: "azure", AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "westus", DEFAULT_VOICEOVER_VOICE: "v" });
        expect(t).toMatchObject({ provider: "azure", apiKey: "k", params: { region: "westus", voice: "v" } });
    });
});

describe("direct LLM (memory reflection)", () => {
    it("needs a key for hosted providers", () => {
        expect(resolveDirectLlm({ LLM_PROVIDER: "openai" })).toBeNull();
        expect(resolveDirectLlm({ LLM_PROVIDER: "openai", LLM_API_KEY: "sk" })).toEqual({
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk",
            model: "gpt-4.1-mini",
        });
    });

    it("works without a key for ollama", () => {
        expect(resolveDirectLlm({ LLM_PROVIDER: "ollama" })?.baseUrl).toBe("http://localhost:11434/v1");
    });
});

describe("providerWarnings", () => {
    it("is empty for a complete config and explains an incomplete one", () => {
        expect(providerWarnings({ LLM_PROVIDER: "openai", LLM_API_KEY: "sk" })).toEqual([]);
        expect(providerWarnings({ LLM_PROVIDER: "openrouter" }).join(" ")).toMatch(/LLM_MODEL/);
        expect(providerWarnings({ LLM_PROVIDER: "openai" }).join(" ")).toMatch(/no API key/);
    });
});
