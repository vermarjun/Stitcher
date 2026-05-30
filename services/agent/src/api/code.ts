/**
 * POST /code — accepts ONE scene plan + retrieved code examples + style
 * manifest, runs the coder agent and the validator/refiner loop, returns
 * the final validated Manim code for that scene.
 *
 * The orchestrator (e.g. stitcher) is expected to call /plan first, run RAG
 * per scene, then call this endpoint per scene with the retrieved examples.
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { buildCodeGraph } from "../graph/codeGraph.js";
import { saveJob } from "../graph/checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("code");

const ModelConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  baseURL: z.string().optional(),
});

const ScenePlanSchema = z.object({
  index: z.number().int().min(0),
  prompt: z.string().min(1),
  durationSec: z.number().min(1),
  manimFeatures: z.array(z.string()),
  requiredSymbols: z.array(z.string()),
  description: z.string().optional(),
  concepts: z.array(z.string()).optional(),
  visualElements: z.array(z.string()).optional(),
  // Native voiceover (FROZEN CONTRACT v1): ordered narration beats for this scene.
  // Supplied by the orchestrator (echoed from /plan) when voiceover mode is on.
  narration: z.array(z.string()).optional(),
});

const StyleManifestSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  backgroundColor: z.string(),
  accentColor: z.string(),
  fontFamily: z.string(),
  animationPace: z.enum(["slow", "medium", "fast"]),
  positioningZones: z.record(z.string(), z.string()),
  elementNaming: z.record(z.string(), z.string()),
});

const CodeExampleSchema = z.object({
  description: z.string(),
  code: z.string(),
});

const CodeRequestSchema = z.object({
  scenePlan: ScenePlanSchema,
  styleManifest: StyleManifestSchema,
  // Native voiceover (FROZEN CONTRACT v1). Default false → unchanged behavior.
  // When true, scenePlan.narration is REQUIRED and the coder emits a VoiceoverScene.
  voiceover: z.boolean().optional().default(false),
  codeExamples: z.array(CodeExampleSchema).optional().default([]),
  modelConfig: z
    .object({
      coder: ModelConfigSchema.optional(),
      validator: ModelConfigSchema.optional(),
    })
    .optional()
    .default({}),
  limits: z
    .object({
      maxValidationRetries: z.number().min(0).max(10).optional(),
      timeoutSec: z.number().min(10).max(600).optional(),
    })
    .optional(),
  meta: z.object({ traceId: z.string().optional() }).optional(),
});

export function registerCode(app: FastifyInstance): void {
  app.post(
    "/code",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const parseResult = CodeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request", details: parseResult.error.format() });
      }
      const body = parseResult.data;

      // Voiceover contract: narration beats are required when voiceover is on.
      if (body.voiceover && (!Array.isArray(body.scenePlan.narration) || body.scenePlan.narration.length === 0)) {
        return reply.status(400).send({
          error: "Invalid request",
          details: "voiceover=true requires scenePlan.narration to be a non-empty string array",
        });
      }

      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;

      log.info(
        { jobId, sceneIndex: body.scenePlan.index, examples: body.codeExamples.length },
        "Code job created"
      );

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "code" });

      // The codeGraph runs single-scene at index 0 internally — normalise the
      // incoming plan to that index. The class name in the output reflects 0,
      // but we expose the requested original index in the response for the caller.
      const incomingIndex = body.scenePlan.index;
      const normalisedPlan = { ...body.scenePlan, index: 0 };
      // The codeGraph forces the generated class name to the NORMALISED index
      // (always "Scene00" — see codeGen buildUserMessage). The render service
      // locates the output mp4 by this class name, so the sceneClass we report
      // MUST equal the real class in the emitted code, NOT the caller's original
      // index. Reporting Scene<incomingIndex> caused ArtifactMissing for every
      // scene with index != 0 (manim wrote Scene00.mp4, render looked for SceneNN.mp4).
      const emittedSceneClass = "Scene00";

      const initialState = {
        jobId,
        mode: "generate" as const,
        voiceover: body.voiceover,
        traceId: body.meta?.traceId ?? req.traceId,
        scenes: [normalisedPlan],
        styleManifest: body.styleManifest,
        codeExamples: body.codeExamples,
        modelConfig: body.modelConfig,
        limits: body.limits,
        sceneStates: {},
        events: [],
        llmCallLog: [],
        messages: [],
      };

      await saveJob(jobId, initialState);

      const graph = buildCodeGraph();

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Code job timed out")), timeoutMs)
        );
        const run = graph.invoke(initialState);
        const finalState = (await Promise.race([run, timeout])) as Record<string, unknown>;

        await saveJob(jobId, finalState);

        const sceneStates = (finalState["sceneStates"] ?? {}) as Record<
          number,
          { status: string; finalCode?: string; attempts?: unknown[] }
        >;
        const sceneState = sceneStates[0];
        const error = finalState["error"];

        const success = !!sceneState && sceneState.status === "done" && !!sceneState.finalCode;

        publishEvent(jobId, success ? "job_complete" : "job_failed", {
          output: success
            ? {
                sceneIndex: incomingIndex,
                sceneClass: emittedSceneClass,
                code: sceneState.finalCode,
                status: sceneState.status,
                attempts: sceneState.attempts,
                ...(body.voiceover ? { narration: body.scenePlan.narration } : {}),
              }
            : null,
          error,
        });

        return reply.send({
          success,
          jobId,
          output: sceneState
            ? {
                sceneIndex: incomingIndex,
                sceneClass: emittedSceneClass,
                code: sceneState.finalCode,
                status: sceneState.status,
                attempts: sceneState.attempts,
                ...(body.voiceover ? { narration: body.scenePlan.narration } : {}),
              }
            : null,
          error: error ?? null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ jobId, err: msg }, "Code graph error");
        publishEvent(jobId, "job_failed", { error: { summary: msg } });
        return reply.status(500).send({ success: false, jobId, error: { summary: msg } });
      } finally {
        setTimeout(() => removeEmitter(jobId), 30_000);
      }
    }
  );
}
