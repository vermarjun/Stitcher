/**
 * CodeGen agent node — SINGLE LLM COMPLETION (no ReAct/tools/recursion).
 *
 * CONTRACT 2: accepts { prompt, examples, requiredApis, voiceover:true, styleManifest? }.
 * Builds system+user message from the coder_voiceover prompt + cheatsheet block
 * (always injected from requiredApis) + RAG examples. One model.invoke() call.
 * No createReactAgent, no manimApiCheckTool/astPreviewTool, no recursion.
 *
 * Preserves: gen_ai span, stitcher.llm.tokens metric, llmCallLog in returned state.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, SceneState, CodeExample } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { getPrompt } from "../prompts/registry.js";
import { lookupCheatsheet } from "../tools/cheatsheet.js";
import { lookupSkills } from "../tools/skills.js";
import { publishEvent } from "../events/emitter.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage } from "../observability/llm.js";

const log = getLogger("codeGen");

function stripThinking(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function extractCodeBlock(text: string): string | null {
  const stripped = stripThinking(text);
  // Try tagged block first (on stripped, fall back to original)
  const tagged = stripped.match(/```python\s+fixed_code\s*\n([\s\S]*?)```/i) ?? text.match(/```python\s+fixed_code\s*\n([\s\S]*?)```/i);
  if (tagged) return tagged[1]!.trim();
  // Fall back to any python block
  const plain = stripped.match(/```python\s*\n([\s\S]*?)```/i) ?? text.match(/```python\s*\n([\s\S]*?)```/i);
  if (plain) return plain[1]!.trim();
  // Last resort: if response starts with `from manim`
  if (stripped.startsWith("from manim")) return stripped;
  if (text.trim().startsWith("from manim")) return text.trim();
  return null;
}

/**
 * Build the coder-memory block (de-duplicated, capped to 25 lessons / ~4000 chars).
 * This is APPENDED to the BOTTOM of the system prompt and explicitly framed as
 * lower-priority hints — the rules above always win. (Lessons can be noisy or even
 * contradictory; they must never override the core rules or the retrieved context.)
 */
function buildCoderMemoryBlock(lessons: string[]): string | null {
  if (!lessons.length) return null;
  // De-duplicate while preserving order (lessons can repeat across jobs).
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of lessons) {
    const t = l.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
  }
  const capped = unique.slice(0, 25);
  let block =
    "## Hints from past renders (LOWER PRIORITY than every rule above — ignore any that conflict with the rules, the plugin skills, or the retrieved examples)\n" +
    capped.map((l) => `- ${l}`).join("\n");
  if (block.length > 4000) block = block.slice(0, 4000);
  return block;
}

export async function codeGenNode(
  state: GraphState,
  sceneIndex: number
): Promise<Partial<GraphState>> {
  const { jobId, codeExamples, modelConfig } = state;
  // Feature 3 — coderMemory passed through state (cast via unknown for TS compat)
  const coderMemory = (state as unknown as Record<string, unknown>)["coderMemory"] as string[] | undefined;

  publishEvent(jobId, "codegen_started", { sceneIndex, sceneCount: 1 });
  log.info({ jobId, sceneIndex }, "CodeGen started (single completion)");

  // Merge per-request overrides with env defaults — per-request wins.
  // If the request sends a partial role config (e.g. only model+params) we fill
  // the rest from env so the factory always has a valid provider + model.
  const reqCoder = modelConfig.coder;
  const coderCfg = {
    provider: reqCoder?.provider ?? config.defaultProvider,
    model:    reqCoder?.model    ?? config.defaultModelCoder,
    apiKey:   reqCoder?.apiKey,
    baseURL:  reqCoder?.baseURL,
    temperature: reqCoder?.temperature,
    maxTokens:   reqCoder?.maxTokens,
    params:      reqCoder?.params,
  };

  // Voiceover is always on per CONTRACT 2; fall back gracefully if flag absent
  const voiceover = state.voiceover !== false;
  const model = getModel(coderCfg);

  // Always use the voiceover coder prompt
  const { systemPrompt: rawPrompt } = getPrompt("coder_voiceover");
  let systemPrompt = rawPrompt.replace(/\{INDEX:02d\}/g, String(sceneIndex).padStart(2, "0"));

  // Feature 3 — append coder memory to the BOTTOM of the system prompt (was top).
  // Junk/contradictory lessons at the top poisoned everything below; as a fenced,
  // lower-priority trailer they inform without overriding the rules or context.
  const memBlock = coderMemory?.length ? buildCoderMemoryBlock(coderMemory) : null;
  if (memBlock) {
    systemPrompt = `${systemPrompt}\n\n${memBlock}`;
  }

  const userContent = buildUserMessage(
    state,
    sceneIndex,
    codeExamples,
    voiceover
  );

  // Feature 2 — build exact messages array for capture
  const messagesArray = [new SystemMessage(systemPrompt), new HumanMessage(userContent)];

  const t0 = Date.now();
  let responseText = "";
  try {
    // SINGLE model.invoke() — no agent, no tools, no recursion
    const result = await withGenAiSpan("coder", coderCfg, () =>
      model.invoke(
        messagesArray,
        { callbacks: getLangfuseCallbacks("coder", { traceId: state.traceId, jobId }) }
      )
    );

    // model.invoke() returns a BaseMessage directly (not {messages:[...]})
    responseText =
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);

    // Feature 2 — attach full I/O DIRECTLY to the usage entry. A module-level
    // side-channel (setLastIo) gets duplicated under the tsup bundle and silently
    // drops the merge, so build the entry inline here instead.
    const usage = {
      ...(takeLastUsage() ?? {
        role: "coder", provider: "unknown", model: "unknown",
        inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      }),
      systemPrompt,
      userPrompt: userContent,
      fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
      rawOutput: responseText,
    };

    const code = extractCodeBlock(responseText);
    const elapsed = Date.now() - t0;

    if (!code) {
      log.warn({ jobId, sceneIndex }, "CodeGen produced no extractable code");
      const sceneStates: GraphState["sceneStates"] = {
        [sceneIndex]: {
          plan: state.scenes?.[sceneIndex] ?? {
            index: sceneIndex,
            prompt: state.prompt ?? "",
            durationSec: 90,
            manimFeatures: [],
            requiredSymbols: [],
          },
          attempts: [],
          status: "failed",
        },
      };
      return { sceneStates, ...(usage ? { llmCallLog: [usage] } : {}) };
    }

    publishEvent(jobId, "codegen_complete", { sceneIndex, codeLength: code.length });
    log.info({ jobId, sceneIndex, elapsed }, "CodeGen complete (single completion)");

    const plan = state.scenes?.[sceneIndex] ?? {
      index: sceneIndex,
      prompt: state.prompt ?? "",
      durationSec: 90,
      manimFeatures: [],
      requiredSymbols: [],
    };

    const sceneState: SceneState = {
      plan,
      attempts: [],
      status: "validating",
      finalCode: code,
    };

    return { sceneStates: { [sceneIndex]: sceneState }, ...(usage ? { llmCallLog: [usage] } : {}) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, sceneIndex, err: msg }, "CodeGen error");

    // Feature 2 — capture I/O even on error (direct attach, no side-channel)
    const errorUsage = {
      ...(takeLastUsage() ?? {
        role: "coder", provider: "unknown", model: "unknown",
        inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      }),
      systemPrompt,
      userPrompt: userContent,
      fullInput: messagesArray.map((m) => ({ type: m._getType(), content: m.content })),
      rawOutput: responseText || "",
      error: msg,
    };

    return {
      sceneStates: {
        [sceneIndex]: {
          plan: state.scenes?.[sceneIndex] ?? {
            index: sceneIndex,
            prompt: state.prompt ?? "",
            durationSec: 90,
            manimFeatures: [],
            requiredSymbols: [],
          },
          attempts: [],
          status: "failed",
        },
      },
      ...(errorUsage ? { llmCallLog: [errorUsage] } : {}),
    };
  }
}

function buildUserMessage(
  state: GraphState,
  sceneIndex: number,
  codeExamples?: CodeExample[],
  voiceover?: boolean
): string {
  const className = `Scene${String(sceneIndex).padStart(2, "0")}`;

  // Use either the scenes array (legacy path) or the top-level prompt (new path)
  const scene = state.scenes?.[sceneIndex];
  const promptText = scene?.prompt ?? state.prompt ?? "";

  // requiredApis lives on the scene (legacy: requiredSymbols) or on state directly
  // The new CONTRACT 2 shape passes requiredApis at the top level via codeExamples
  // context; we surface it via state.scenes[0].requiredSymbols for the cheatsheet.
  const requiredApis: string[] = (state as unknown as Record<string, unknown>)["requiredApis"] as string[]
    ?? scene?.requiredSymbols
    ?? scene?.manimFeatures
    ?? [];

  // requiredPlugins from RAG query-transform (CONTRACT 1) — drives skill injection.
  const requiredPlugins: string[] =
    ((state as unknown as Record<string, unknown>)["requiredPlugins"] as string[]) ?? [];

  const styleManifest = state.styleManifest;

  const parts: string[] = [
    `Scene class name MUST be: ${className}`,
    `Scene prompt: ${promptText}`,
  ];

  if (scene?.description) parts.push(`Scene description: ${scene.description}`);
  if (scene?.concepts?.length) parts.push(`Concepts: ${scene.concepts.join(", ")}`);
  if (scene?.visualElements?.length) parts.push(`Visual elements: ${scene.visualElements.join(", ")}`);
  if (scene?.durationSec) parts.push(`Duration: ${scene.durationSec} seconds`);
  if (scene?.manimFeatures?.length) parts.push(`Required Manim features: ${scene.manimFeatures.join(", ")}`);

  if (styleManifest) {
    parts.push(`\nStyleManifest:\n${JSON.stringify(styleManifest, null, 2)}`);
  } else {
    // Sensible defaults when no manifest provided
    parts.push(
      `\nStyleManifest (defaults):\n${JSON.stringify(
        {
          // White background is the product default. Foreground colours below are
          // all DARK so they stay legible on white (a white primaryColor here used
          // to render invisible text once the background was flipped to white).
          backgroundColor: "#FFFFFF",
          primaryColor: "#1a1a2e",
          secondaryColor: "#1565c0",
          accentColor: "#e65100",
          fontFamily: "Sans",
          animationPace: "medium",
          positioningZones: { center: "ORIGIN", left: "LEFT * 3.5", right: "RIGHT * 3.5", top: "UP * 2.5", bottom: "DOWN * 2.5" },
          elementNaming: {},
        },
        null,
        2
      )}`
    );
  }

  // Inject plugin skill docs (orientation) for the plugins RAG flagged as relevant,
  // BEFORE the cheatsheet so the model reads "which plugin + how" before the atomic
  // per-symbol signatures.
  if (requiredPlugins.length > 0) {
    const skills = lookupSkills(requiredPlugins);
    if (skills) {
      parts.push(`\n${skills}`);
    }
  }

  // Always inject cheatsheet block for the required APIs (closed-world floor).
  // requiredApis may now include plugin symbols (the query-transform knows plugins),
  // so plugin signatures get surfaced here too.
  if (requiredApis.length > 0) {
    const cheatsheet = lookupCheatsheet(requiredApis);
    if (cheatsheet) {
      parts.push(`\n${cheatsheet}`);
    }
  }

  // Voiceover beats
  if (voiceover) {
    const beats = Array.isArray(scene?.narration) ? scene.narration : [];
    if (beats.length > 0) {
      const numbered = beats.map((b, i) => `Beat ${i + 1}: ${JSON.stringify(b)}`).join("\n");
      parts.push(
        `\nVOICEOVER MODE: ON. You MUST emit a VoiceoverScene with EXACTLY ${beats.length} ` +
          `\`with self.voiceover(text=...)\` block(s), in this exact order, each using the ` +
          `corresponding beat string BELOW VERBATIM (character-for-character — these strings are ` +
          `the audio cache key; do not reword, paraphrase, merge, split, re-punctuate, or fix them).` +
          `\n\nNarration beats (ordered, copy each EXACTLY):\n${numbered}` +
          `\n\nThe same beats as a JSON array for exact copying:\n` +
          "```json\n" + JSON.stringify(beats, null, 2) + "\n```"
      );
    } else {
      // No narration beats provided — instruct model to generate its own
      parts.push(
        `\nVOICEOVER MODE: ON. No narration beats were pre-specified. ` +
          `Generate appropriate narration that explains each animation step. ` +
          `The class MUST be a VoiceoverScene with self.voiceover(text=...) blocks.`
      );
    }
  }

  // RAG code examples
  if (codeExamples?.length) {
    parts.push(
      `\nRetrieved code examples from RAG (use these as ground truth — adapt their patterns to this scene):\n` +
        codeExamples.map((e, i) => `Example ${i + 1} — ${e.description}:\n\`\`\`python\n${e.code}\n\`\`\``).join("\n\n")
    );
  }

  return parts.filter(Boolean).join("\n");
}
