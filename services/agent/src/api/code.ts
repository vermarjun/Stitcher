/**
 * POST /code — CONTRACT 2 (single-completion, no planner).
 *
 * NEW input shape (no scenePlan):
 *   { prompt, examples, requiredApis, voiceover: true, styleManifest? }
 *
 * Old shape (scenePlan/codeExamples) is accepted defensively for backward-compat
 * but the worker should send the new shape.
 *
 * Behavior: ONE LLM completion via codeGenNode (no createReactAgent, no tools,
 * no recursion). Returns { success, output: { code, sceneClass }, tokensUsed,
 * llmCallLog } — envelope unchanged.
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { saveJob } from "../graph/checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { extractLlmCallLog, sumLlmCallLog } from "./tokenUtils.js";
import { codeGenNode } from "../agents/codeGen.js";
import { describeModelError } from "../models/retry.js";
import type { GraphState } from "../graph/state.js";

const log = getLogger("code");

// ── Schema ────────────────────────────────────────────────────────────────────

// Per-role model config: all fields optional for backward-compat.
// params is a freeform override bag (temperature, maxTokens, enable_thinking, etc.)
// that takes precedence over the top-level convenience fields when both are set.
const RoleModelConfigSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
  // Convenience shorthands kept for backward-compat (model factory reads params first)
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  params: z
    .object({
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
      enable_thinking: z.boolean().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

// New CONTRACT 2 example shape
const CodeExampleSchema = z.object({
  description: z.string(),
  code: z.string(),
});

// Legacy scene plan — kept for backward-compat
const ScenePlanSchema = z.object({
  index: z.number().int().min(0),
  prompt: z.string().min(1),
  durationSec: z.number().min(1),
  manimFeatures: z.array(z.string()),
  requiredSymbols: z.array(z.string()),
  description: z.string().optional(),
  concepts: z.array(z.string()).optional(),
  visualElements: z.array(z.string()).optional(),
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
}).optional().nullable();

const CodeRequestSchema = z.object({
  // ── NEW CONTRACT 2 fields ──────────────────────────────────────────────────
  prompt: z.string().min(1).optional(),
  examples: z.array(CodeExampleSchema).optional().default([]),
  requiredApis: z.array(z.string()).optional().default([]),
  // Plugin names from RAG query-transform (e.g. ["manim-chess"]); drive skill injection.
  requiredPlugins: z.array(z.string()).optional().default([]),
  voiceover: z.boolean().optional().default(true),   // always true in new flow
  styleManifest: StyleManifestSchema,

  // ── Feature 3 — Coder memory (past mistakes to avoid) ────────────────────
  coderMemory: z.array(z.string()).optional(),

  // ── LEGACY fields (backward-compat) ───────────────────────────────────────
  scenePlan: ScenePlanSchema.optional(),
  codeExamples: z.array(CodeExampleSchema).optional(),

  modelConfig: z
    .object({
      coder: RoleModelConfigSchema.optional(),
      validator: RoleModelConfigSchema.optional(),
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

/** Say why the coder failed: the model error if there was one, else no usable code. */
function failureSummary(llmCallLog: unknown[]): string {
  const failed = (llmCallLog as Array<{ error?: unknown }>).find((e) => typeof e?.error === "string");
  return failed
    ? `CodeGen failed: ${describeModelError(failed.error as string)}`
    : "CodeGen failed to produce valid code: the model reply had no Python code block";
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

      // Resolve effective prompt — new shape wins, legacy scene plan is fallback
      const effectivePrompt = body.prompt ?? body.scenePlan?.prompt;
      if (!effectivePrompt) {
        return reply.status(400).send({ error: "Invalid request", details: "prompt or scenePlan.prompt is required" });
      }

      // Merge examples from both shapes
      const examples = body.examples?.length ? body.examples : (body.codeExamples ?? []);

      // Required APIs: new shape or legacy requiredSymbols
      const requiredApis = body.requiredApis?.length
        ? body.requiredApis
        : (body.scenePlan?.requiredSymbols ?? body.scenePlan?.manimFeatures ?? []);

      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;
      const SCENE_INDEX = 0;

      log.info(
        { jobId, examples: examples.length, requiredApis: requiredApis.length },
        "Code job created (single completion)"
      );

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "code" });

      // Build a minimal scene plan for the graph state (codeGenNode may reference it)
      const scenePlan = body.scenePlan
        ? { ...body.scenePlan, index: SCENE_INDEX }
        : {
            index: SCENE_INDEX,
            prompt: effectivePrompt,
            durationSec: 90,
            manimFeatures: requiredApis,
            requiredSymbols: requiredApis,
            narration: undefined as string[] | undefined,
          };

      // Build graph state for codeGenNode.
      // GraphState is a complex LangGraph annotation type — cast through unknown
      // to avoid TS complaining about fields managed internally by the graph runtime.
      const graphStateBase = {
        jobId,
        mode: "generate" as const,
        voiceover: body.voiceover ?? true,
        traceId: body.meta?.traceId ?? (req as unknown as { traceId?: string }).traceId,
        prompt: effectivePrompt,
        scenes: [scenePlan],
        styleManifest: (body.styleManifest ?? undefined) as GraphState["styleManifest"],
        codeExamples: examples,
        modelConfig: body.modelConfig,
        limits: body.limits,
        sceneStates: {} as GraphState["sceneStates"],
        events: [] as GraphState["events"],
        llmCallLog: [] as GraphState["llmCallLog"],
        messages: [] as GraphState["messages"],
        // Surface requiredApis so codeGenNode can pick them up for cheatsheet lookup
        ...(requiredApis.length ? { requiredApis } : {}),
        // Surface requiredPlugins so codeGenNode injects the matching skill docs
        ...(body.requiredPlugins?.length ? { requiredPlugins: body.requiredPlugins } : {}),
        // Feature 3 — pass coder memory to the codeGen node
        ...(body.coderMemory?.length ? { coderMemory: body.coderMemory } : {}),
      };
      const graphState = graphStateBase as unknown as GraphState & { requiredApis?: string[]; requiredPlugins?: string[]; coderMemory?: string[] };

      await saveJob(jobId, graphState);

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Code job timed out")), timeoutMs)
        );

        // Single completion — invoke codeGenNode directly (no graph/recursion)
        const run = codeGenNode(graphState, SCENE_INDEX);
        const partial = (await Promise.race([run, timeout])) as Partial<GraphState>;

        // Merge back into state for checkpointing
        const finalState = { ...graphState, ...partial };
        await saveJob(jobId, finalState);

        const sceneState = partial.sceneStates?.[SCENE_INDEX];
        const success = !!sceneState && sceneState.status !== "failed" && !!sceneState.finalCode;

        // Accumulate llmCallLog
        const llmCallLog = extractLlmCallLog(partial as Record<string, unknown>);
        const tokensUsed = sumLlmCallLog(llmCallLog);

        const emittedSceneClass = `Scene${String(SCENE_INDEX).padStart(2, "0")}`;

        publishEvent(jobId, success ? "job_complete" : "job_failed", {
          output: success
            ? { sceneClass: emittedSceneClass, code: sceneState!.finalCode }
            : null,
        });

        return reply.send({
          success,
          jobId,
          output: success
            ? {
                code: sceneState!.finalCode,
                sceneClass: emittedSceneClass,
                status: sceneState!.status,
              }
            : null,
          error: success ? null : { summary: failureSummary(llmCallLog) },
          llmCallLog,
          tokensUsed,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ jobId, err: msg }, "Code job error");
        publishEvent(jobId, "job_failed", { error: { summary: msg } });
        return reply.status(500).send({ success: false, jobId, error: { summary: msg } });
      } finally {
        setTimeout(() => removeEmitter(jobId), 30_000);
      }
    }
  );
}
