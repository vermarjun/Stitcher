/**
 * POST /plan — accepts a prompt, runs the planner agent only, returns scene
 * plans + style manifest. Synchronous (single LLM call, ~10–30s).
 *
 * The orchestrator (e.g. stitcher) is expected to feed each scene's
 * description + concepts + visualElements into a separate RAG service to
 * retrieve code examples, then call POST /code per scene.
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { buildPlanGraph } from "../graph/planGraph.js";
import { saveJob } from "../graph/checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("plan");

const ModelConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  baseURL: z.string().optional(),
});

const PlanRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  modelConfig: z
    .object({ planner: ModelConfigSchema.optional() })
    .optional()
    .default({}),
  userPreferences: z
    .object({
      primaryColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      animationPace: z.enum(["slow", "medium", "fast"]).optional(),
      complexityLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      preferredDomain: z.string().optional(),
    })
    .optional(),
  styleManifestOverride: z.any().optional(),
  constraints: z
    .object({
      minScenes: z.number().optional(),
      maxScenes: z.number().min(1).max(8).optional(),
      maxSceneDurationSec: z.number().optional(),
      targetTotalDurationSec: z.number().optional(),
      renderQualityHint: z.enum(["low", "medium", "high"]).optional(),
    })
    .optional(),
  limits: z
    .object({ timeoutSec: z.number().min(10).max(600).optional() })
    .optional(),
  meta: z.object({ traceId: z.string().optional() }).optional(),
});

export function registerPlan(app: FastifyInstance): void {
  app.post(
    "/plan",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const parseResult = PlanRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request", details: parseResult.error.format() });
      }
      const body = parseResult.data;
      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;

      log.info({ jobId, prompt: body.prompt.slice(0, 80) }, "Plan job created");

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "plan" });

      const initialState = {
        jobId,
        mode: "generate" as const,
        prompt: body.prompt,
        modelConfig: body.modelConfig,
        userPreferences: body.userPreferences,
        styleManifestOverride: body.styleManifestOverride,
        constraints: body.constraints,
        limits: body.limits,
        sceneStates: {},
        events: [],
        llmCallLog: [],
        messages: [],
      };

      await saveJob(jobId, initialState);

      const graph = buildPlanGraph();

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Plan job timed out")), timeoutMs)
        );
        const run = graph.invoke(initialState);
        const finalState = (await Promise.race([run, timeout])) as Record<string, unknown>;

        await saveJob(jobId, finalState);

        const scenes = finalState["scenes"] as unknown[] | undefined;
        const styleManifest = finalState["styleManifest"];
        const error = finalState["error"];

        const success = !error && Array.isArray(scenes) && scenes.length > 0;

        publishEvent(jobId, success ? "job_complete" : "job_failed", {
          output: success ? { scenes, styleManifest } : null,
          error,
        });

        return reply.send({
          success,
          jobId,
          output: success ? { scenes, styleManifest } : null,
          error: error ?? null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ jobId, err: msg }, "Plan graph error");
        publishEvent(jobId, "job_failed", { error: { summary: msg } });
        return reply.status(500).send({ success: false, jobId, error: { summary: msg } });
      } finally {
        setTimeout(() => removeEmitter(jobId), 30_000);
      }
    }
  );
}
