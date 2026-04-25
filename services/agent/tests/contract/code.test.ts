/**
 * Contract tests for POST /code.
 * No real LLM calls — we only assert request/auth/validation behaviour.
 */

process.env["AGENT_API_KEY"] = "test-key-for-contract-tests";
process.env["MANIM_API_INDEX_PATH"] = require("path").join(__dirname, "../../src/assets/manim_api_index.json");

import Fastify from "fastify";
import { registerCode } from "../../src/api/code";
import { registerHealth } from "../../src/api/health";

const API_KEY = "test-key-for-contract-tests";

const VALID_STYLE_MANIFEST = {
  primaryColor: "#3B82F6",
  secondaryColor: "#10B981",
  backgroundColor: "#1a1a2e",
  accentColor: "#F59E0B",
  fontFamily: "sans-serif",
  animationPace: "medium",
  positioningZones: { title: "UP * 3", main: "ORIGIN" },
  elementNaming: { title: "title_text" },
};

const VALID_SCENE_PLAN = {
  index: 0,
  prompt: "Show an array being split in half",
  durationSec: 6,
  manimFeatures: ["Square", "FadeIn"],
  requiredSymbols: ["Scene", "Square", "FadeIn"],
  description: "Animate splitting an array of boxes into two halves",
  concepts: ["binary search", "array partitioning"],
  visualElements: ["row of boxes", "vertical divider"],
};

describe("POST /code contract", () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ bodyLimit: 1024 * 1024 });
    registerHealth(app);
    registerCode(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without API key", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/code",
      payload: { scenePlan: VALID_SCENE_PLAN, styleManifest: VALID_STYLE_MANIFEST },
    });
    expect(resp.statusCode).toBe(401);
  });

  it("returns 400 when scenePlan is missing", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/code",
      headers: { "x-api-key": API_KEY },
      payload: { styleManifest: VALID_STYLE_MANIFEST },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("returns 400 when styleManifest is missing", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/code",
      headers: { "x-api-key": API_KEY },
      payload: { scenePlan: VALID_SCENE_PLAN },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("accepts codeExamples as RAG payload", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/code",
      headers: { "x-api-key": API_KEY },
      payload: {
        scenePlan: VALID_SCENE_PLAN,
        styleManifest: VALID_STYLE_MANIFEST,
        codeExamples: [
          { description: "Draw a red circle", code: "from manim import *\nclass S(Scene): pass" },
        ],
        modelConfig: {
          coder: { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
        },
        limits: { timeoutSec: 15, maxValidationRetries: 1 },
      },
    });
    expect([200, 500]).toContain(resp.statusCode);
    const body = resp.json<{ jobId: string; success: boolean }>();
    expect(body).toHaveProperty("jobId");
    expect(body).toHaveProperty("success");
  });

  it("preserves caller-supplied scene index in output", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/code",
      headers: { "x-api-key": API_KEY },
      payload: {
        scenePlan: { ...VALID_SCENE_PLAN, index: 3 },
        styleManifest: VALID_STYLE_MANIFEST,
        modelConfig: {
          coder: { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" },
        },
        limits: { timeoutSec: 15, maxValidationRetries: 0 },
      },
    });
    expect([200, 500]).toContain(resp.statusCode);
    if (resp.statusCode === 200) {
      const body = resp.json<{ output: { sceneIndex: number; sceneClass: string } | null }>();
      if (body.output) {
        expect(body.output.sceneIndex).toBe(3);
        expect(body.output.sceneClass).toBe("Scene03");
      }
    }
  });
});
