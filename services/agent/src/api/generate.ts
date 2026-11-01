/**
 * POST /generate — accepts a prompt, returns 202 with jobId + streamUrl.
 * Kick off the generate graph in the background.
 *
 * POST /generate?wait=true — blocking variant, returns 200 with full output.
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { buildGenerateGraph } from "../graph/generateGraph.js";
import { saveJob } from "../graph/checkpointer.js";
import { isJobCancelled } from "./jobs.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("generate");

// ── Request schema ────────────────────────────────────────────────────────────

const ModelConfigSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  baseURL: z.string().optional(),
});

const GenerateRequestSchema = z.object({
  // Raised 4000 → 64000 to accept RAG-grounded prompts (see plan.ts rationale).
  prompt: z.string().min(1).max(64000),
  // Native voiceover (FROZEN CONTRACT v1). Default false → unchanged behavior.
  voiceover: z.boolean().optional().default(false),
  modelConfig: z
    .object({
      planner: ModelConfigSchema.optional(),
      coder: ModelConfigSchema.optional(),
      debugger: ModelConfigSchema.optional(),
      validator: ModelConfigSchema.optional(),
    })
    .optional()
    .default({}),
  context: z
    .object({
      retrievalContext: z
        .object({
          apiExamples: z.array(z.object({ symbol: z.string(), snippet: z.string() })).optional(),
          similarScripts: z.array(z.object({ prompt: z.string(), code: z.string() })).optional(),
          styleRecommendations: z.array(z.string()).optional(),
          pitfalls: z.array(z.string()).optional(),
        })
        .optional(),
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
    })
    .optional()
    .default({}),
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
    .object({
      maxValidationRetries: z.number().min(0).max(10).optional(),
      timeoutSec: z.number().min(10).max(600).optional(),
    })
    .optional(),
  meta: z.object({ traceId: z.string().optional() }).optional(),
});

// ── Route ─────────────────────────────────────────────────────────────────────

export function registerGenerate(app: FastifyInstance): void {
  app.post<{ Querystring: { wait?: string } }>(
    "/generate",
    { preHandler: authMiddleware },
    async (req, reply) => {
      // Validate body
      const parseResult = GenerateRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request", details: parseResult.error.format() });
      }
      const body = parseResult.data;
      const wait = req.query.wait === "true";
      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;

      log.info({ jobId, prompt: body.prompt.slice(0, 80), wait }, "Generate job created");

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "generate" });

      const initialState = {
        jobId,
        mode: "generate" as const,
        voiceover: body.voiceover,
        traceId: body.meta?.traceId ?? req.traceId,
        prompt: body.prompt,
        modelConfig: body.modelConfig,
        retrievalContext: body.context?.retrievalContext,
        userPreferences: body.context?.userPreferences,
        styleManifestOverride: body.context?.styleManifestOverride,
        constraints: body.constraints,
        limits: body.limits,
        sceneStates: {},
        events: [],
        llmCallLog: [],
        messages: [],
      };

      await saveJob(jobId, initialState);

      const graph = buildGenerateGraph();

      async function runGraph() {
        try {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Job timed out")), timeoutMs)
          );
          const run = graph.invoke(initialState);
          const finalState = await Promise.race([run, timeout]);

          if (isJobCancelled(jobId)) return;
          await saveJob(jobId, finalState);
          publishEvent(jobId, "job_complete", { output: buildOutput(finalState), execution: buildExecution(finalState) });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error({ jobId, err: msg }, "Generate graph error");
          publishEvent(jobId, "job_failed", { error: { summary: msg } });
        } finally {
          setTimeout(() => removeEmitter(jobId), 30_000);
        }
      }

      if (wait) {
        // Blocking mode — wait for graph completion
        await runGraph();
        const finalState = (await import("../graph/checkpointer.js").then((m) => m.loadJob(jobId))) as ReturnType<typeof buildOutput> | null;
        return reply.send(finalState);
      } else {
        // Non-blocking — return 202 immediately
        void runGraph();
        return reply.status(202).send({
          jobId,
          streamUrl: `/stream/${jobId}`,
          syncUrl: `/jobs/${jobId}`,
        });
      }
    }
  );
}

function buildOutput(state: Record<string, unknown>) {
  const sceneStates = (state["sceneStates"] ?? {}) as Record<string, { status: string; finalCode?: string; attempts?: unknown[]; plan?: unknown }>;
  return {
    scenes: Object.entries(sceneStates).map(([idx, s]) => ({
      index: parseInt(idx, 10),
      sceneClass: `Scene${idx.padStart(2, "0")}`,
      code: s.finalCode,
      status: s.status,
      validation: s.attempts?.[s.attempts.length - 1],
    })),
  };
}

function buildExecution(state: Record<string, unknown>) {
  const log = (state["llmCallLog"] ?? []) as Array<{ inputTokens: number; outputTokens: number }>;
  return {
    totalLlmCalls: log.length,
    totalInputTokens: log.reduce((s, c) => s + (c.inputTokens ?? 0), 0),
    totalOutputTokens: log.reduce((s, c) => s + (c.outputTokens ?? 0), 0),
  };
}
