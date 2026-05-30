/**
 * Refiner agent — called when the validator rejects CodeGen output.
 *
 * Receives: failing code + ValidationReport
 * Returns: fixed code
 * Same model role as Debugger, different system prompt framing.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, SceneState, ValidationReport } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { manimApiCheckTool } from "../tools/manimApiCheck.js";
import { astPreviewTool } from "../tools/astPreview.js";
import { getPrompt } from "../prompts/registry.js";
import { publishEvent } from "../events/emitter.js";
import { validate } from "../validation/pipeline.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage } from "../observability/llm.js";

const log = getLogger("refiner");

function extractCode(text: string): string | null {
  const tagged = text.match(/```python\s+fixed_code\s*\n([\s\S]*?)```/i);
  if (tagged) return tagged[1]!.trim();
  const plain = text.match(/```python\s*\n([\s\S]*?)```/i);
  if (plain) return plain[1]!.trim();
  if (text.trim().startsWith("from manim")) return text.trim();
  return null;
}

export async function refinerNode(
  state: GraphState,
  sceneIndex: number,
  failingCode: string,
  report: ValidationReport
): Promise<Partial<GraphState>> {
  const { jobId, modelConfig } = state;
  const sceneState = state.sceneStates[sceneIndex];
  const maxRetries = state.limits?.maxValidationRetries ?? config.defaultMaxValidationRetries;

  if (!sceneState) return {};

  const attemptNumber = sceneState.attempts.length;

  publishEvent(jobId, "validator_retrying", {
    sceneIndex,
    attempt: attemptNumber,
    reason: report.failFast ?? "validation failed",
  });

  if (attemptNumber >= maxRetries) {
    log.warn({ jobId, sceneIndex, attempts: attemptNumber }, "Refiner: max retries exhausted");
    const updated: SceneState = { ...sceneState, status: "failed" };
    return { sceneStates: { [sceneIndex]: updated } };
  }

  const coderCfg = modelConfig.coder ?? { provider: config.defaultProvider, model: config.defaultModelCoder };
  const model = getModel(coderCfg);
  const { systemPrompt } = getPrompt("refiner");
  const tools = [manimApiCheckTool, astPreviewTool];
  const agent = createReactAgent({ llm: model, tools });

  const expectedClass = `Scene${String(sceneIndex).padStart(2, "0")}`;
  const voiceover = state.voiceover === true;
  const narration = voiceover ? sceneState.plan?.narration : undefined;

  // In voiceover mode, give the refiner the exact beats so it can correct
  // beat-text drift (the `voiceoverBeats` check) without re-inventing structure.
  const voiceoverInstr = voiceover
    ? [
        `\nVOICEOVER MODE: ON. This is a VoiceoverScene. PRESERVE the voiceover structure:`,
        `- keep \`from manim_voiceover import VoiceoverScene\` and \`from stitcher_voiceover import OfflineTTS\`,`,
        `- keep the class as \`${expectedClass}(VoiceoverScene)\`,`,
        `- keep \`self.set_speech_service(OfflineTTS(), create_subcaption=False)\` as the first line of construct,`,
        `- keep EXACTLY one \`with self.voiceover(text=...)\` block per beat, in order, each using \`run_time=tracker.duration\`.`,
        `If the validator reported a \`voiceoverBeats\` / "voiceover narration drift" failure (it may list MISSING/EXTRA/ALTERED beats), it means a \`self.voiceover(text=...)\` string was reworded, merged, split, re-punctuated, or made dynamic (an f-string or variable). You MUST restore each block's text to the EXACT beat string below, character-for-character. Use ONLY plain string literals — never an f-string, format call, or variable — for the \`text=\` argument.`,
        `\nThe authoritative narration beats (ordered — copy each EXACTLY into one voiceover block):`,
        "```json\n" + JSON.stringify(narration ?? [], null, 2) + "\n```",
      ].join("\n")
    : "";

  const userContent = [
    `Fix the following Manim code. The validator found these issues:`,
    `\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
    `\nFailing code:\n\`\`\`python\n${failingCode}\n\`\`\``,
    `Expected class name: ${expectedClass}`,
    sceneState.plan ? `Original scene prompt: ${sceneState.plan.prompt}` : "",
    voiceoverInstr,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await withGenAiSpan("refiner", coderCfg, () =>
      agent.invoke(
        { messages: [new SystemMessage(systemPrompt), new HumanMessage(userContent)] },
        { callbacks: getLangfuseCallbacks("refiner", { traceId: state.traceId, jobId }) }
      )
    );
    const usage = takeLastUsage();

    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string" ? lastMessage.content : JSON.stringify(lastMessage?.content);

    const fixedCode = extractCode(responseText);
    if (!fixedCode) {
      log.warn({ jobId, sceneIndex }, "Refiner produced no code");
      const attempt = { code: failingCode, validation: report, elapsedMs: 0 };
      const updated: SceneState = {
        ...sceneState,
        attempts: [...sceneState.attempts, attempt],
        status: "failed",
      };
      return { sceneStates: { [sceneIndex]: updated }, ...(usage ? { llmCallLog: [usage] } : {}) };
    }

    // Re-validate (with narration beats in voiceover mode so the beat-equality
    // check re-runs and gates the fix)
    const newReport = await validate(fixedCode, expectedClass, narration);

    publishEvent(jobId, "validator_result", {
      sceneIndex,
      attempt: attemptNumber + 1,
      passed: newReport.passed,
      failures: Object.entries(newReport.checks)
        .filter(([, v]) => v !== "ok")
        .map(([k]) => k),
    });

    const attempt = { code: fixedCode, validation: newReport, elapsedMs: 0 };
    const updated: SceneState = {
      ...sceneState,
      attempts: [...sceneState.attempts, attempt],
      status: newReport.passed ? "done" : "refining",
      finalCode: newReport.passed ? fixedCode : sceneState.finalCode,
    };

    return { sceneStates: { [sceneIndex]: updated }, ...(usage ? { llmCallLog: [usage] } : {}) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, sceneIndex, err: msg }, "Refiner error");
    const updated: SceneState = { ...sceneState, status: "failed" };
    return { sceneStates: { [sceneIndex]: updated } };
  }
}
