process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";
import { getModel } from "../../src/models/factory";
import { config, DEFAULT_MODELS } from "../../src/config";
import { ChatOpenAI } from "@langchain/openai";

describe("getModel factory", () => {
  it("throws for unsupported provider", () => {
    expect(() =>
      getModel({ provider: "fakeProvider", model: "x", apiKey: "k" })
    ).toThrow("Unsupported provider");
  });

  it("constructs OpenAI model without throwing", () => {
    expect(() =>
      getModel({ provider: "openai", model: "gpt-4o", apiKey: "sk-test" })
    ).not.toThrow();
  });

  it("constructs Anthropic model without throwing", () => {
    expect(() =>
      getModel({ provider: "anthropic", model: "claude-3-5-haiku-latest", apiKey: "sk-ant-test" })
    ).not.toThrow();
  });

  it("constructs opencodego model (OpenAI-compat) without throwing", () => {
    expect(() =>
      getModel({ provider: "opencodego", model: "kimi-k2.5", apiKey: "sk-test" })
    ).not.toThrow();
  });

  it("constructs openrouter model with correct baseURL", () => {
    const model = getModel({ provider: "openrouter", model: "anthropic/claude-3-haiku", apiKey: "sk-or-test" });
    expect(model).toBeDefined();
  });
});

describe("provider isolation", () => {
  it.each(["openai", "openrouter", "groq", "ollama"])("does not send enable_thinking to %s", (provider) => {
    const model = getModel({ provider, model: "test", apiKey: "fake", params: { enable_thinking: true } }) as ChatOpenAI;
    expect(model.modelKwargs).not.toHaveProperty("enable_thinking");
  });

  it("sends the OpenCode default and allows overriding it", () => {
    const make = (params?: { enable_thinking: boolean }) => getModel({ provider: "opencodego", model: "test", apiKey: "fake", params }) as ChatOpenAI;
    expect(make().modelKwargs).toEqual({ enable_thinking: false });
    expect(make({ enable_thinking: true }).modelKwargs).toEqual({ enable_thinking: true });
  });

  it.each([
    ["openai", "openaiApiKey", "OPENAI_API_KEY"],
    ["openrouter", "openrouterApiKey", "OPENROUTER_API_KEY"],
    ["groq", "groqApiKey", "GROQ_API_KEY"],
    ["opencodego", "opencodeGoApiKey", "OPENCODE_GO_API_KEY"],
    ["anthropic", "anthropicApiKey", "ANTHROPIC_API_KEY"],
    ["gemini", "geminiApiKey", "GEMINI_API_KEY"],
  ])("names the missing key for %s", (provider, field, env) => {
    const mutable = config as unknown as Record<string, unknown>;
    const original = mutable[field];
    mutable[field] = undefined;
    try {
      expect(() => getModel({ provider, model: "test" })).toThrow(env);
    } finally {
      mutable[field] = original;
    }
  });

  it("defaults Ollama to its local OpenAI-compatible endpoint", () => {
    const model = getModel({ provider: "ollama", model: "test" }) as ChatOpenAI;
    expect(model.clientConfig.baseURL).toBe(config.ollamaBaseUrl);
  });

  it("passes the configured Gemini key", () => {
    const mutable = config as unknown as Record<string, unknown>;
    const original = mutable.geminiApiKey;
    mutable.geminiApiKey = "fake-gemini-key";
    try {
      expect(getModel({ provider: "gemini", model: "test" })).toHaveProperty("apiKey", "fake-gemini-key");
    } finally {
      mutable.geminiApiKey = original;
    }
  });

  it("has an explicit default model for every provider", () => {
    expect(Object.keys(DEFAULT_MODELS).sort()).toEqual(["openai", "anthropic", "gemini", "openrouter", "groq", "ollama", "opencodego", "bedrock"].sort());
  });
});
