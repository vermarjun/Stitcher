/**
 * modelConfig.util.test.ts
 *
 * Tests resolveModelConfig() in isolation:
 *   - ApiKey.find() is mocked via vi.mock so no Mongoose connection is needed.
 *   - crypto.util is mocked via vi.mock because modelConfig.util.ts uses a
 *     dynamic require("../util/crypto.util") to avoid importing at module load
 *     time (config validation side-effect).  In vitest's Vite-based transform,
 *     dynamic require() of .ts files does NOT work at runtime — so we intercept
 *     the call by mocking the module.  decrypt() just returns the string as-is
 *     for tests since we're providing plaintext "keys" in the fake DB records.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted before any import that uses them) ─────────────────────────

vi.mock("../../model/userapikeys.model", () => {
    return {
        default: {
            find: vi.fn(),
        },
    };
});

// Mock crypto.util so the dynamic require("../util/crypto.util") inside
// modelConfig.util.ts resolves to our stub.  decrypt returns the value as-is
// (simulates already-plaintext keys in the mocked DB records).
vi.mock("../../util/crypto.util", () => {
    return {
        encrypt: (s: string) => s,
        decrypt: (s: string) => s,
        isEncrypted: (s: string) => s.startsWith("enc:v1:"),
    };
});

import ApiKey from "../../model/userapikeys.model";
import { resolveModelConfig, hasOwnKeys } from "../modelConfig.util";
import type { ResolvedModelConfig } from "../types";

const mockFind = ApiKey.find as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockFindReturns(records: unknown[]) {
    mockFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue(records),
    });
}

function mockFindThrows(err: Error) {
    mockFind.mockReturnValue({
        lean: vi.fn().mockRejectedValue(err),
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveModelConfig", () => {
    it("returns env defaults when user has no active API keys", async () => {
        mockFindReturns([]);

        const config = await resolveModelConfig("user-123");

        // Defaults use the OpenCodeGo backend; no per-user key/baseURL so the
        // agent service falls back to its own OPENCODE_GO_API_KEY.
        expect(config.planner.provider).toBe("opencodego");
        expect(config.planner.model).toBe("glm-5.1");
        expect(config.coder.model).toBe("glm-5.1");
        expect(config.debugger.model).toBe("glm-5.1");
        // No apiKey on defaults
        expect(config.planner.apiKey).toBeUndefined();
    });

    it("applies user's stored key for the planner role", async () => {
        // keyValue is passed as-is; our mocked decrypt() returns it unchanged
        mockFindReturns([
            {
                agentId: "planner",
                keyValue: "sk-live-user-key-abc123",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "anthropic/claude-opus-4-5",
            },
        ]);

        const config = await resolveModelConfig("user-456");

        expect(config.planner.apiKey).toBe("sk-live-user-key-abc123");
        expect(config.planner.model).toBe("anthropic/claude-opus-4-5");
        expect(config.planner.baseURL).toBe("https://openrouter.ai/api/v1");
        // Other roles should still be env defaults
        expect(config.coder.apiKey).toBeUndefined();
    });

    it("applies user's stored key for the coder role", async () => {
        mockFindReturns([
            {
                agentId: "coder",
                keyValue: "sk-coder-key-xyz",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "anthropic/claude-sonnet-4-6",
            },
        ]);

        const config = await resolveModelConfig("user-coder");
        expect(config.coder.apiKey).toBe("sk-coder-key-xyz");
        expect(config.planner.apiKey).toBeUndefined();
    });

    it("maps legacy 'reviewer' agentId to 'validator' role", async () => {
        mockFindReturns([
            {
                agentId: "reviewer", // legacy DB name
                keyValue: "sk-reviewer-key",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "anthropic/claude-haiku-4-5",
            },
        ]);

        const config = await resolveModelConfig("user-789");
        expect(config.validator?.apiKey).toBe("sk-reviewer-key");
    });

    it("maps 'optimizer' agentId to 'validator' role", async () => {
        mockFindReturns([
            {
                agentId: "optimizer",
                keyValue: "sk-optimizer-key",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "anthropic/claude-haiku-4-5",
            },
        ]);

        const config = await resolveModelConfig("user-opt");
        expect(config.validator?.apiKey).toBe("sk-optimizer-key");
    });

    it("falls back to env defaults silently on Mongoose error (does not throw)", async () => {
        mockFindThrows(new Error("MongoNetworkError"));

        // Must resolve, not reject
        const config = await resolveModelConfig("user-error");

        expect(config.planner.provider).toBe("opencodego");
        expect(config.coder.provider).toBe("opencodego");
    });

    it("applies caller overrides on top of resolved config", async () => {
        mockFindReturns([]); // no user keys

        const override = {
            planner: {
                provider: "openai",
                model: "gpt-4o",
                apiKey: "sk-override-abc",
            },
        };

        const config = await resolveModelConfig("user-123", override);

        expect(config.planner.provider).toBe("openai");
        expect(config.planner.model).toBe("gpt-4o");
        // Coder should still be default
        expect(config.coder.provider).toBe("opencodego");
    });

    it("ignores keys with unknown agentId gracefully", async () => {
        mockFindReturns([
            {
                agentId: "totally_unknown_role",
                keyValue: "sk-unknown",
                baseUrl: "https://api.example.com",
                modelName: "some-model",
            },
        ]);

        // Should not throw, just return defaults
        const config = await resolveModelConfig("user-unknown");
        expect(config.planner.apiKey).toBeUndefined();
    });

    it("applies multiple user keys across different roles", async () => {
        mockFindReturns([
            {
                agentId: "planner",
                keyValue: "sk-planner",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "model-a",
            },
            {
                agentId: "debugger",
                keyValue: "sk-debugger",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "model-b",
            },
        ]);

        const config = await resolveModelConfig("user-multi");

        expect(config.planner.apiKey).toBe("sk-planner");
        expect(config.debugger.apiKey).toBe("sk-debugger");
        expect(config.coder.apiKey).toBeUndefined();
    });
});

// ─── hasOwnKeys (credit-exhaust gate logic) ───────────────────────────────────

describe("hasOwnKeys", () => {
    // Build a minimal config with an optional coder apiKey.
    function makeConfig(coderApiKey?: string): ResolvedModelConfig {
        return {
            planner: { provider: "opencodego", model: "glm-5.1" },
            coder: { provider: "opencodego", model: "glm-5.1", apiKey: coderApiKey },
            debugger: { provider: "opencodego", model: "glm-5.1" },
        };
    }

    it("returns false for the shared-key env defaults (no apiKey)", () => {
        expect(hasOwnKeys(makeConfig(undefined))).toBe(false);
    });

    it("returns true when the coder role carries a user-supplied apiKey", () => {
        expect(hasOwnKeys(makeConfig("sk-user-coder-key"))).toBe(true);
    });

    it("returns false for an empty / whitespace-only apiKey", () => {
        expect(hasOwnKeys(makeConfig(""))).toBe(false);
        expect(hasOwnKeys(makeConfig("   "))).toBe(false);
    });

    it("is driven by the coder role (the billed role), not planner/debugger", () => {
        // planner+debugger have keys but coder does not → still shared-key funded
        const cfg: ResolvedModelConfig = {
            planner: { provider: "openrouter", model: "m", apiKey: "sk-planner" },
            coder: { provider: "opencodego", model: "glm-5.1" },
            debugger: { provider: "openrouter", model: "m", apiKey: "sk-debugger" },
        };
        expect(hasOwnKeys(cfg)).toBe(false);
    });

    it("integrates with resolveModelConfig: user coder key flips the gate to true", async () => {
        mockFindReturns([
            {
                agentId: "coder",
                keyValue: "sk-coder-byot",
                baseUrl: "https://openrouter.ai/api/v1",
                modelName: "anthropic/claude-sonnet-4-6",
            },
        ]);
        const config = await resolveModelConfig("byot-user");
        expect(hasOwnKeys(config)).toBe(true);
    });

    it("integrates with resolveModelConfig: no user keys keeps the gate false", async () => {
        mockFindReturns([]);
        const config = await resolveModelConfig("keyless-user");
        expect(hasOwnKeys(config)).toBe(false);
    });
});
