/**
 * Contract tests for POST /plan.
 * No real LLM calls — we only assert request/auth/validation behaviour.
 */

process.env["AGENT_API_KEY"] = "test-key-for-contract-tests";
process.env["MANIM_API_INDEX_PATH"] = require("path").join(__dirname, "../../src/assets/manim_api_index.json");

import Fastify from "fastify";
import { registerPlan } from "../../src/api/plan";
import { registerHealth } from "../../src/api/health";

const API_KEY = "test-key-for-contract-tests";

describe("POST /plan contract", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ bodyLimit: 1024 * 1024 });
    registerHealth(app);
    registerPlan(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without API key", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/plan",
      payload: { prompt: "explain binary search" },
    });
    expect(resp.statusCode).toBe(401);
  });

  it("returns 400 for empty prompt", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/plan",
      headers: { "x-api-key": API_KEY },
      payload: { prompt: "" },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("returns 400 for maxScenes > 8", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/plan",
      headers: { "x-api-key": API_KEY },
      payload: {
        prompt: "explain binary search",
        constraints: { maxScenes: 99 },
      },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("accepts valid input (graph may fail without real LLM, but not 400/401)", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/plan",
      headers: { "x-api-key": API_KEY },
      payload: {
        prompt: "Explain binary search",
        modelConfig: {
          planner: { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
        },
        limits: { timeoutSec: 15 },
      },
    });
    expect([200, 500]).toContain(resp.statusCode);
    const body = resp.json<{ jobId: string; success: boolean }>();
    expect(body).toHaveProperty("jobId");
    expect(body).toHaveProperty("success");
  });
});
