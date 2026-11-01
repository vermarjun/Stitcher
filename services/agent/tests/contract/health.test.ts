/**
 * Contract test for GET /health.
 * Starts a real Fastify instance (no LLM calls needed).
 */

process.env["AGENT_API_KEY"] = "test-key-for-contract-tests";
process.env["MANIM_API_INDEX_PATH"] = require("path").join(__dirname, "../../src/assets/manim_api_index.json");

import "./mocks";
import Fastify from "fastify";
import { registerHealth } from "../../src/api/health";

describe("GET /health", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    registerHealth(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns status field", async () => {
    const resp = await app.inject({ method: "GET", url: "/health" });
    const body = resp.json<{ status: string; checks: Record<string, string> }>();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("checks");
  });

  it("returns 200 or 503", async () => {
    const resp = await app.inject({ method: "GET", url: "/health" });
    expect([200, 503]).toContain(resp.statusCode);
  });
});
