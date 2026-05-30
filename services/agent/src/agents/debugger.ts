/**
 * Debugger agent — public POST /debug endpoint handler.
 *
 * Receives: broken Manim code + stderr error + optional original prompt
 * Returns: fixed code + diff + change summary
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, ValidationReport } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { manimApiCheckTool } from "../tools/manimApiCheck.js";
import { astPreviewTool } from "../tools/astPreview.js";
import { diffTool } from "../tools/diff.js";
import { getPrompt } from "../prompts/registry.js";
import { publishEvent } from "../events/emitter.js";
import { validate } from "../validation/pipeline.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage } from "../observability/llm.js";
import type { LlmCallLog } from "../graph/state.js";

const log = getLogger("debugger");

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp("```(?:[a-z]*)\\s+" + tag + "\\s*\\n([\\s\\S]*?)```", "i");
  const m = text.match(re);
  return m ? m[1]!.trim() : null;
}

function extractAnyCode(text: string): string | null {
  const plain = text.match(/```python\s*\n([\s\S]*?)```/i);
  if (plain) return plain[1]!.trim();
  if (text.trim().startsWith("from manim")) return text.trim();
  return null;
}

export async function debuggerNode(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, brokenCode, brokenError, sceneClass, previousAttempts, modelConfig } = state as GraphState & { sceneClass?: string };
  const maxRetries = state.limits?.maxValidationRetries ?? config.defaultMaxValidationRetries;

  publishEvent(jobId, "debugger_started", { jobId });
  log.info({ jobId }, "Debugger started");

  const debugCfg = modelConfig.debugger ?? { provider: config.defaultProvider, model: config.defaultModelDebugger };
  const model = getModel(debugCfg);
  const { systemPrompt } = getPrompt("debugger");
  const tools = [manimApiCheckTool, astPreviewTool, diffTool];
  const agent = createReactAgent({ llm: model, tools });

  const voiceover = state.voiceover === true;
  const narration = voiceover ? state.scenes?.[0]?.narration : undefined;
  const voiceoverInstr = voiceover
    ? [
        `VOICEOVER MODE: ON. This is a manim_voiceover VoiceoverScene. You MUST preserve its voiceover structure while fixing the error:`,
        `- keep \`from manim_voiceover import VoiceoverScene\` and \`from stitcher_voiceover import OfflineTTS\`,`,
        `- keep the scene class subclassing \`VoiceoverScene\`,`,
        `- keep \`self.set_speech_service(OfflineTTS(), create_subcaption=False)\` as the first line of construct,`,
        `- keep EXACTLY one \`with self.voiceover(text=...)\` block per narration beat, in order, each driving \`run_time=tracker.duration\`,`,
        `- DO NOT reword, merge, split, or re-punctuate any \`self.voiceover(text=...)\` string. They must stay character-for-character identical to the beats below.`,
        narration?.length
          ? "\nAuthoritative narration beats (ordered — each must appear verbatim in exactly one voiceover block):\n```json\n" +
            JSON.stringify(narration, null, 2) +
            "\n```"
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const userContent = [
    brokenCode ? `Broken code:\n\`\`\`python\n${brokenCode}\n\`\`\`` : "",
    brokenError
      ? `Error:\nCategory: ${brokenError.category ?? "Unknown"}\nSummary: ${brokenError.summary}\nLine: ${brokenError.line ?? "unknown"}\nStderr:\n${brokenError.stderr}`
      : "",
    state.originalPrompt ? `Original prompt: ${state.originalPrompt}` : "",
    sceneClass ? `Scene class: ${sceneClass}` : "",
    voiceoverInstr,
    previousAttempts?.length
      ? `Previous failed attempts (do NOT repeat these fixes):\n${previousAttempts.map((a) => `Fix tried: ${a.code.slice(0, 200)}\nError: ${a.error}`).join("\n---\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let lastCode = brokenCode ?? "";
  let lastValidation: ValidationReport | null = null;
  let changeSummary = "";
  let diffOutput = "";
  const llmCallLog: LlmCallLog[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withGenAiSpan("debugger", debugCfg, () =>
        agent.invoke(
          {
            messages: [
              new SystemMessage(systemPrompt),
              new HumanMessage(attempt === 0 ? userContent : `Attempt ${attempt} also failed validation:\n${JSON.stringify(lastValidation)}\n\nPrevious code:\n\`\`\`python\n${lastCode}\n\`\`\`\nTry a different approach.`),
            ],
          },
          { callbacks: getLangfuseCallbacks("debugger", { traceId: state.traceId, jobId }) }
        )
      );
      const usage = takeLastUsage();
      if (usage) llmCallLog.push(usage);

      const lastMessage = result.messages[result.messages.length - 1];
      const responseText =
        typeof lastMessage?.content === "string" ? lastMessage.content : JSON.stringify(lastMessage?.content);

      const fixedCode = extractBlock(responseText, "fixed_code") ?? extractAnyCode(responseText);
      changeSummary = extractBlock(responseText, "change_summary") ?? "";
      diffOutput = extractBlock(responseText, "diff") ?? "";

      if (!fixedCode) {
        log.warn({ jobId, attempt }, "Debugger produced no code");
        continue;
      }

      lastCode = fixedCode;
      const report = await validate(fixedCode, sceneClass, narration);
      lastValidation = report;

      publishEvent(jobId, "validator_result", {
        attempt,
        passed: report.passed,
        failures: Object.entries(report.checks).filter(([, v]) => v !== "ok").map(([k]) => k),
      });

      if (report.passed) {
        publishEvent(jobId, "debugger_complete", { diff: diffOutput });
        return {
          fixedCode,
          fixedValidation: report,
          changeSummary,
          diff: diffOutput,
          ...(llmCallLog.length ? { llmCallLog } : {}),
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ jobId, attempt, err: msg }, "Debugger attempt error");
    }
  }

  return {
    fixedCode: lastCode,
    fixedValidation: lastValidation ?? undefined,
    changeSummary: "Max retries exhausted — partial fix only",
    error: { summary: "Debugger could not produce passing code after max retries" },
    ...(llmCallLog.length ? { llmCallLog } : {}),
  };
}
