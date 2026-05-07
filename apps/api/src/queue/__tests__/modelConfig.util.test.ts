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
import { resolveModelConfig } from "../modelConfig.util";

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

        expect(config.planner.provider).toBe("openrouter");
        expect(config.planner.model).toBe("anthropic/claude-sonnet-4-6");
        expect(config.coder.model).toBe("anthropic/claude-sonnet-4-6");
        expect(config.debugger.model).toBe("anthropic/claude-haiku-4-5");
        // No apiKeyOverride on defaults
        expect(config.planner.apiKeyOverride).toBeUndefined();
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

        expect(config.planner.apiKeyOverride).toBe("sk-live-user-key-abc123");
        expect(config.planner.model).toBe("anthropic/claude-opus-4-5");
        expect(config.planner.baseUrlOverride).toBe("https://openrouter.ai/api/v1");
        // Other roles should still be env defaults
        expect(config.coder.apiKeyOverride).toBeUndefined();
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
        expect(config.coder.apiKeyOverride).toBe("sk-coder-key-xyz");
        expect(config.planner.apiKeyOverride).toBeUndefined();
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
        expect(config.validator?.apiKeyOverride).toBe("sk-reviewer-key");
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
        expect(config.validator?.apiKeyOverride).toBe("sk-optimizer-key");
    });

    it("falls back to env defaults silently on Mongoose error (does not throw)", async () => {
        mockFindThrows(new Error("MongoNetworkError"));

        // Must resolve, not reject
        const config = await resolveModelConfig("user-error");

        expect(config.planner.provider).toBe("openrouter");
        expect(config.coder.provider).toBe("openrouter");
    });

    it("applies caller overrides on top of resolved config", async () => {
        mockFindReturns([]); // no user keys

        const override = {
            planner: {
                provider: "openai",
                model: "gpt-4o",
                apiKeyOverride: "sk-override-abc",
            },
        };

        const config = await resolveModelConfig("user-123", override);

        expect(config.planner.provider).toBe("openai");
        expect(config.planner.model).toBe("gpt-4o");
        // Coder should still be default
        expect(config.coder.provider).toBe("openrouter");
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
        expect(config.planner.apiKeyOverride).toBeUndefined();
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

        expect(config.planner.apiKeyOverride).toBe("sk-planner");
        expect(config.debugger.apiKeyOverride).toBe("sk-debugger");
        expect(config.coder.apiKeyOverride).toBeUndefined();
    });
});
