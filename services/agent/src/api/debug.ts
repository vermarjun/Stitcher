/**
 * POST /debug — broken Manim code + error → fixed code
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { buildDebugGraph } from "../graph/debugGraph.js";
import { saveJob, loadJob } from "../graph/checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("debug");

const ModelConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  baseURL: z.string().optional(),
});

const DebugRequestSchema = z.object({
  brokenCode: z.string().min(1).max(524288),
  sceneClass: z.string().optional(),
  error: z.object({
    stderr: z.string(),
    summary: z.string(),
    line: z.number().optional(),
    category: z.string().optional(),
  }),
  originalPrompt: z.string().optional(),
  previousAttempts: z
    .array(z.object({ code: z.string(), error: z.string() }))
    .optional(),
  modelConfig: z
    .object({
      debugger: ModelConfigSchema.optional(),
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

export function registerDebug(app: FastifyInstance): void {
  app.post(
    "/debug",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const parseResult = DebugRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request", details: parseResult.error.format() });
      }
      const body = parseResult.data;
      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;

      log.info({ jobId, sceneClass: body.sceneClass }, "Debug job created");

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "debug" });

      const initialState = {
        jobId,
        mode: "debug" as const,
        brokenCode: body.brokenCode,
        sceneClass: body.sceneClass,
        brokenError: body.error,
        originalPrompt: body.originalPrompt,
        previousAttempts: body.previousAttempts,
        modelConfig: body.modelConfig,
        limits: body.limits,
        sceneStates: {},
        events: [],
        llmCallLog: [],
        messages: [],
      };

      await saveJob(jobId, initialState);

      const graph = buildDebugGraph();

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Debug job timed out")), timeoutMs)
        );
        const run = graph.invoke(initialState);
        const finalState = (await Promise.race([run, timeout])) as Record<string, unknown>;

        await saveJob(jobId, finalState);

        const success = !finalState["error"] || !!finalState["fixedCode"];
        publishEvent(jobId, success ? "job_complete" : "job_failed", {
          output: finalState["fixedCode"]
            ? {
                sceneClass: body.sceneClass,
                code: finalState["fixedCode"],
                changeSummary: finalState["changeSummary"],
                diff: finalState["diff"],
                validation: finalState["fixedValidation"],
              }
            : null,
          error: finalState["error"],
        });

        return reply.send({
          success,
          jobId,
          output: success
            ? {
                sceneClass: body.sceneClass,
                code: finalState["fixedCode"],
                changeSummary: finalState["changeSummary"],
                diff: finalState["diff"],
                validation: finalState["fixedValidation"],
              }
            : null,
          error: finalState["error"],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ jobId, err: msg }, "Debug graph error");
        publishEvent(jobId, "job_failed", { error: { summary: msg } });
        return reply.status(500).send({ success: false, jobId, error: { summary: msg } });
      } finally {
        setTimeout(() => removeEmitter(jobId), 30_000);
      }
    }
  );
}
