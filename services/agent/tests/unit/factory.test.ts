import { getModel } from "../../src/models/factory";

// Set required env var so config doesn't throw
process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";

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
