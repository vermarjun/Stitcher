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

      const initialState = {
        jobId,
        mode: "generate" as const,
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
                sceneClass: `Scene${String(incomingIndex).padStart(2, "0")}`,
                code: sceneState.finalCode,
                status: sceneState.status,
                attempts: sceneState.attempts,
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
                sceneClass: `Scene${String(incomingIndex).padStart(2, "0")}`,
                code: sceneState.finalCode,
                status: sceneState.status,
                attempts: sceneState.attempts,
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
