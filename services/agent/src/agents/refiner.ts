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
  const userContent = [
    `Fix the following Manim code. The validator found these issues:`,
    `\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
    `\nFailing code:\n\`\`\`python\n${failingCode}\n\`\`\``,
    `Expected class name: ${expectedClass}`,
    sceneState.plan ? `Original scene prompt: ${sceneState.plan.prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await agent.invoke({
      messages: [new SystemMessage(systemPrompt), new HumanMessage(userContent)],
    });

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
      return { sceneStates: { [sceneIndex]: updated } };
    }

    // Re-validate
    const newReport = await validate(fixedCode, expectedClass);

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

    return { sceneStates: { [sceneIndex]: updated } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, sceneIndex, err: msg }, "Refiner error");
    const updated: SceneState = { ...sceneState, status: "failed" };
    return { sceneStates: { [sceneIndex]: updated } };
  }
}
