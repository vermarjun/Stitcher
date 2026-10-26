/**
 * POST /reflect — Feature 3 (Coder Mistake Memory).
 *
 * After a debug loop ends, the worker calls this endpoint to extract a short
 * lesson from the failure. Returns a 1–2 sentence lesson string plus the full
 * LLM I/O record so the worker can persist a GenerationLlmIO row.
 *
 * Input:  { prompt, originalCode, finalError?, debugHistory: [{ code?, error?, changeSummary? }], modelConfig? }
 * Output: { success, lesson: string, llmIO: { systemPrompt, userPrompt, fullInput, rawOutput, model, tokensUsed } }
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { authMiddleware } from "../middleware/auth.js";
import { getModel } from "../models/factory.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage, setLastIo } from "../observability/llm.js";

const log = getLogger("reflect");

const RoleModelConfigSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
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

const DebugHistoryItemSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  changeSummary: z.string().optional(),
});

const ReflectRequestSchema = z.object({
  prompt: z.string().min(1),
  originalCode: z.string().min(1),
  finalError: z.string().optional(),
  debugHistory: z.array(DebugHistoryItemSchema).min(1),
  modelConfig: z
    .object({
      debugger: RoleModelConfigSchema.optional(),
    })
    .optional()
    .default({}),
});

const REFLECT_SYSTEM_PROMPT =
  "You convert a fixed Manim bug into ONE reusable coding rule for the code-generation model that will read it later. " +
  "Output a single imperative instruction (a do/don't) telling the coder how to avoid this class of bug next time. " +
  "Write it as a direct command in the present tense, generalized beyond this one case. " +
  "Do NOT describe what happened, do NOT say 'the coder' / 'the code' / 'this scene', no preamble, no markdown — output only the rule. " +
  "Example: \"Always pass a positive duration to self.wait(); never call self.wait(0).\"";

export function registerReflect(app: FastifyInstance): void {
  app.post(
    "/reflect",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const parseResult = ReflectRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Invalid request", details: parseResult.error.format() });
      }
      const body = parseResult.data;

      // Use debugger model config (falls back to env debugger model)
      const reqDebugger = body.modelConfig?.debugger;
      const debugCfg = {
        provider: reqDebugger?.provider ?? config.defaultProvider,
        model:    reqDebugger?.model    ?? config.defaultModelDebugger,
        apiKey:   reqDebugger?.apiKey,
        baseURL:  reqDebugger?.baseURL,
        temperature: reqDebugger?.temperature ?? 0.2,
        // Low maxTokens — single short lesson only
        maxTokens: reqDebugger?.maxTokens ?? 300,
        params:   reqDebugger?.params,
      };

      const model = getModel(debugCfg);

      // Build user message: prompt + originalCode + errors + changeSummaries
      const historyText = body.debugHistory
        .map((h, i) => {
          const parts: string[] = [`Debug attempt ${i + 1}:`];
          if (h.error) parts.push(`  Error: ${h.error}`);
          if (h.changeSummary) parts.push(`  Change: ${h.changeSummary}`);
          return parts.join("\n");
        })
        .join("\n");

      const userContent = [
        `Original prompt: ${body.prompt}`,
        `\nOriginal (broken) code:\n\`\`\`python\n${body.originalCode}\n\`\`\``,
        body.finalError ? `\nFinal error:\n${body.finalError}` : "",
        `\nDebugger history:\n${historyText}`,
      ]
        .filter(Boolean)
        .join("\n");

      const messagesArray = [
        new SystemMessage(REFLECT_SYSTEM_PROMPT),
        new HumanMessage(userContent),
      ];

      let responseText = "";
      try {
        const result = await withGenAiSpan("debugger", debugCfg, () =>
          model.invoke(
            messagesArray,
            { callbacks: getLangfuseCallbacks("debugger", {}) }
          )
        );

        responseText =
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

        setLastIo({
          systemPrompt: REFLECT_SYSTEM_PROMPT,
          userPrompt: userContent,
          fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
          rawOutput: responseText,
        });
        const usage = takeLastUsage();

        const lesson = responseText.trim();

        const llmIO = {
          systemPrompt: REFLECT_SYSTEM_PROMPT,
          userPrompt: userContent,
          fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
          rawOutput: responseText,
          model: debugCfg.model,
          tokensUsed: usage
            ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.inputTokens + usage.outputTokens }
            : undefined,
        };

        log.info({ lesson: lesson.slice(0, 120) }, "Reflect complete");

        return reply.send({
          success: true,
          lesson,
          llmIO,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err: msg }, "Reflect error");

        setLastIo({
          systemPrompt: REFLECT_SYSTEM_PROMPT,
          userPrompt: userContent,
          fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
          rawOutput: responseText || "",
          error: msg,
        });
        takeLastUsage(); // clear

        return reply.status(500).send({ success: false, error: { summary: msg } });
      }
    }
  );
}
