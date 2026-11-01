/**
 * Debugger agent — CONTRACT 3 (single completion, no internal loop).
 *
 * The worker loops externally (max 3 attempts). Each call here does ONE
 * model.invoke(), injects the cheatsheet for broken symbols, and preserves
 * self.voiceover blocks verbatim.
 *
 * Preserves: gen_ai span, stitcher.llm.tokens metric, llmCallLog.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { getPrompt } from "../prompts/registry.js";
import { lookupCheatsheet } from "../tools/cheatsheet.js";
import { publishEvent } from "../events/emitter.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage } from "../observability/llm.js";
import type { LlmCallLog } from "../graph/state.js";

const log = getLogger("debugger");

function stripThinking(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp("```(?:[a-z]*)\\s+" + tag + "\\s*\\n([\\s\\S]*?)```", "i");
  const stripped = stripThinking(text);
  const m = stripped.match(re) ?? text.match(re);
  return m ? m[1]!.trim() : null;
}

function extractAnyCode(text: string): string | null {
  const stripped = stripThinking(text);
  const plain = stripped.match(/```python\s*\n([\s\S]*?)```/i) ?? text.match(/```python\s*\n([\s\S]*?)```/i);
  if (plain) return plain[1]!.trim();
  if (stripped.startsWith("from manim")) return stripped;
  if (text.trim().startsWith("from manim")) return text.trim();
  return null;
}

/**
 * Extract all Manim symbol names referenced in a code block (simple heuristic).
 * Used to build the cheatsheet block from the symbols actually in the broken code.
 */
function extractSymbolsFromCode(code: string): string[] {
  // Grab capitalized words that look like Manim class names
  const matches = code.match(/\b[A-Z][A-Za-z0-9]+/g) ?? [];
  return [...new Set(matches)];
}

export async function debuggerNode(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, brokenCode, brokenError, previousAttempts, modelConfig } = state as GraphState & { sceneClass?: string };
  const sceneClass = (state as GraphState & { sceneClass?: string }).sceneClass;

  publishEvent(jobId, "debugger_started", { jobId });
  log.info({ jobId }, "Debugger started (single completion)");

  // Merge per-request overrides with env defaults — per-request wins.
  const reqDebugger = modelConfig.debugger;
  const debugCfg = {
    provider: reqDebugger?.provider ?? config.defaultProvider,
    model:    reqDebugger?.model    ?? config.defaultModelDebugger,
    apiKey:   reqDebugger?.apiKey,
    baseURL:  reqDebugger?.baseURL,
    temperature: reqDebugger?.temperature,
    maxTokens:   reqDebugger?.maxTokens,
    params:      reqDebugger?.params,
  };
  const model = getModel(debugCfg);
  const { systemPrompt } = getPrompt("debugger");

  const voiceover = state.voiceover === true;
  const narration = voiceover ? state.scenes?.[0]?.narration : undefined;

  // CONTRACT 3: accept apiReference from state (new shape) or derive from broken code
  const rawApiReference = (state as unknown as Record<string, unknown>)["apiReference"] as string[] | undefined;
  const symbolsForCheatsheet: string[] = rawApiReference?.length
    ? rawApiReference
    : extractSymbolsFromCode(brokenCode ?? "");

  const cheatsheet = symbolsForCheatsheet.length > 0 ? lookupCheatsheet(symbolsForCheatsheet) : "";

  // Voiceover preservation instructions
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
    cheatsheet ? `\n${cheatsheet}` : "",
    voiceoverInstr,
    previousAttempts?.length
      ? `Previous failed attempts (do NOT repeat these fixes):\n${previousAttempts.map((a) => `Fix tried: ${a.code.slice(0, 200)}\nError: ${a.error}`).join("\n---\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const llmCallLog: LlmCallLog[] = [];

  // Feature 2 — build exact messages array for capture
  const messagesArray = [new SystemMessage(systemPrompt), new HumanMessage(userContent)];
  let responseText = "";

  try {
    // SINGLE model.invoke() — no agent, no tools, no internal retry loop
    const result = await withGenAiSpan("debugger", debugCfg, () =>
      model.invoke(
        messagesArray,
        { callbacks: getLangfuseCallbacks("debugger", { traceId: state.traceId, jobId }) }
      )
    );

    responseText =
      typeof result.content === "string" ? result.content : JSON.stringify(result.content);

    // Feature 2 — attach full I/O DIRECTLY (side-channel breaks under the bundle)
    const usage = {
      ...(takeLastUsage() ?? {
        role: "debugger", provider: "unknown", model: "unknown",
        inputTokens: 0, outputTokens: 0, durationMs: 0,
        timestamp: new Date().toISOString(),
      }),
      systemPrompt,
      userPrompt: userContent,
      fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
      rawOutput: responseText,
    };
    llmCallLog.push(usage);

    const fixedCode = extractBlock(responseText, "fixed_code") ?? extractAnyCode(responseText);
    const changeSummary = extractBlock(responseText, "change_summary") ?? "";
    const diffOutput = extractBlock(responseText, "diff") ?? "";

    if (!fixedCode) {
      log.warn({ jobId }, "Debugger produced no code");
      return {
        // Do NOT set fixedCode — leave it undefined so the caller can detect failure.
        changeSummary: "Debugger could not extract fixed code",
        error: { summary: "Debugger produced no extractable code" },
        ...(llmCallLog.length ? { llmCallLog } : {}),
      };
    }

    publishEvent(jobId, "debugger_complete", { diff: diffOutput });
    return {
      fixedCode,
      changeSummary,
      diff: diffOutput,
      ...(llmCallLog.length ? { llmCallLog } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, err: msg }, "Debugger error");

    // Feature 2 — capture I/O even on error (direct attach)
    const errorUsage = {
      ...(takeLastUsage() ?? {
        role: "debugger", provider: "unknown", model: "unknown",
        inputTokens: 0, outputTokens: 0, durationMs: 0,
        timestamp: new Date().toISOString(),
      }),
      systemPrompt,
      userPrompt: userContent,
      fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
      rawOutput: responseText || "",
      error: msg,
    };
    llmCallLog.push(errorUsage);

    return {
      // Do NOT set fixedCode — leave it undefined so the caller can detect failure.
      changeSummary: "Debugger threw an exception",
      error: { summary: msg },
      ...(llmCallLog.length ? { llmCallLog } : {}),
    };
  }
}
