/**
 * POST /debug — CONTRACT 3.
 *
 * Input (new shape): { code, error, prompt, apiReference?, voiceover: true }
 * Old shape (brokenCode/originalPrompt) accepted defensively.
 *
 * Behavior: single completion (no internal loop — worker loops max 3).
 * Cheatsheet injected from apiReference symbols. self.voiceover blocks preserved.
 * Output: { success, output: { code, sceneClass, changeSummary }, tokensUsed, llmCallLog }
 */

import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { createEmitter, publishEvent, removeEmitter } from "../events/emitter.js";
import { buildDebugGraph } from "../graph/debugGraph.js";
import { saveJob } from "../graph/checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { extractLlmCallLog, sumLlmCallLog } from "./tokenUtils.js";

const log = getLogger("debug");

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

const DebugRequestSchema = z.object({
  // ── New CONTRACT 3 fields ─────────────────────────────────────────────────
  code: z.string().min(1).max(524288).optional(),
  // error may come as a plain string or as the legacy structured object
  error: z.union([
    z.string(),
    z.object({
      stderr: z.string(),
      summary: z.string(),
      line: z.number().optional(),
      category: z.string().optional(),
    }),
  ]).optional(),
  prompt: z.string().optional(),
  apiReference: z.array(z.string()).optional(),
  voiceover: z.boolean().optional().default(true),
  narration: z.array(z.string()).optional(),

  // ── Legacy fields (backward-compat) ───────────────────────────────────────
  brokenCode: z.string().min(1).max(524288).optional(),
  sceneClass: z.string().optional(),
  originalPrompt: z.string().optional(),
  previousAttempts: z
    .array(z.object({ code: z.string(), error: z.string() }))
    .optional(),

  modelConfig: z
    .object({
      debugger: RoleModelConfigSchema.optional(),
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

      // Resolve effective fields — new shape wins, legacy is fallback
      const effectiveCode = body.code ?? body.brokenCode;
      if (!effectiveCode) {
        return reply.status(400).send({ error: "Invalid request", details: "code or brokenCode is required" });
      }
      const effectivePrompt = body.prompt ?? body.originalPrompt;
      const effectiveSceneClass = body.sceneClass;

      // Normalise error to the structured shape the graph state expects
      let brokenError: { stderr: string; summary: string; line?: number; category?: string } | undefined;
      if (body.error) {
        if (typeof body.error === "string") {
          brokenError = { stderr: body.error, summary: body.error };
        } else {
          brokenError = body.error;
        }
      }

      const jobId = uuidv4();
      const timeoutMs = (body.limits?.timeoutSec ?? config.defaultTimeoutSec) * 1000;

      log.info({ jobId, sceneClass: effectiveSceneClass }, "Debug job created (single completion)");

      createEmitter(jobId);
      publishEvent(jobId, "job_started", { mode: "debug" });

      const initialState = {
        jobId,
        mode: "debug" as const,
        voiceover: body.voiceover ?? true,
        traceId: body.meta?.traceId ?? (req as unknown as { traceId?: string }).traceId,
        brokenCode: effectiveCode,
        sceneClass: effectiveSceneClass,
        // Pass narration via a synthetic scene so debuggerNode can access beats
        ...(body.voiceover && body.narration
          ? {
              scenes: [
                {
                  index: 0,
                  prompt: effectivePrompt ?? "",
                  durationSec: 1,
                  manimFeatures: [],
                  requiredSymbols: [],
                  narration: body.narration,
                },
              ],
            }
          : {}),
        brokenError,
        originalPrompt: effectivePrompt,
        previousAttempts: body.previousAttempts,
        modelConfig: body.modelConfig,
        limits: body.limits,
        // CONTRACT 3: surface apiReference so debuggerNode injects the cheatsheet
        ...(body.apiReference?.length ? { apiReference: body.apiReference } : {}),
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

        const success = !!finalState["fixedCode"] && !finalState["error"];

        const llmCallLog = extractLlmCallLog(finalState);
        const tokensUsed = sumLlmCallLog(llmCallLog);

        publishEvent(jobId, success ? "job_complete" : "job_failed", {
          output: finalState["fixedCode"]
            ? {
                sceneClass: effectiveSceneClass,
                code: finalState["fixedCode"],
                changeSummary: finalState["changeSummary"],
                diff: finalState["diff"],
              }
            : null,
          error: finalState["error"],
        });

        return reply.send({
          success,
          jobId,
          output: success
            ? {
                sceneClass: effectiveSceneClass,
                code: finalState["fixedCode"],
                changeSummary: finalState["changeSummary"],
                diff: finalState["diff"],
              }
            : null,
          error: finalState["error"],
          llmCallLog,
          tokensUsed,
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
