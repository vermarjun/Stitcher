/**
 * CodeGen agent node.
 *
 * Generates code for ONE scene. Called in parallel for all scenes via
 * LangGraph's Send API (fan-out). Each instance receives:
 *   - state.scenes[sceneIndex] (the plan for this scene)
 *   - state.styleManifest (read-only, shared)
 *   - state.retrievalContext (optional RAG injection)
 *
 * Emits: codegen_started, codegen_complete
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, ScenePlan, StyleManifest, SceneState, CodeExample } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { manimApiCheckTool } from "../tools/manimApiCheck.js";
import { astPreviewTool } from "../tools/astPreview.js";
import { getPrompt } from "../prompts/registry.js";
import { publishEvent } from "../events/emitter.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("codeGen");

function extractCodeBlock(text: string): string | null {
  // Try tagged block first
  const tagged = text.match(/```python\s+fixed_code\s*\n([\s\S]*?)```/i);
  if (tagged) return tagged[1]!.trim();
  // Fall back to any python block
  const plain = text.match(/```python\s*\n([\s\S]*?)```/i);
  if (plain) return plain[1]!.trim();
  // Last resort: if response starts with `from manim`
  if (text.trim().startsWith("from manim")) return text.trim();
  return null;
}

export async function codeGenNode(
  state: GraphState,
  sceneIndex: number
): Promise<Partial<GraphState>> {
  const { jobId, styleManifest, scenes, retrievalContext, codeExamples, modelConfig } = state;
  const scene = scenes?.[sceneIndex];

  if (!scene || !styleManifest) {
    return {};
  }

  publishEvent(jobId, "codegen_started", { sceneIndex, sceneCount: scenes?.length ?? 1 });
  log.info({ jobId, sceneIndex }, "CodeGen started");

  const coderCfg = modelConfig.coder ?? {
    provider: config.defaultProvider,
    model: config.defaultModelCoder,
  };

  const model = getModel(coderCfg);
  const { systemPrompt: rawPrompt } = getPrompt("coder");
  const systemPrompt = rawPrompt.replace(/\{INDEX:02d\}/g, String(sceneIndex).padStart(2, "0"));

  const tools = [manimApiCheckTool, astPreviewTool];
  const agent = createReactAgent({ llm: model, tools });

  const userContent = buildUserMessage(scene, styleManifest, sceneIndex, retrievalContext, codeExamples);

  const t0 = Date.now();
  try {
    const result = await agent.invoke({
      messages: [new SystemMessage(systemPrompt), new HumanMessage(userContent)],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content);

    const code = extractCodeBlock(responseText);
    const elapsed = Date.now() - t0;

    if (!code) {
      log.warn({ jobId, sceneIndex }, "CodeGen produced no extractable code");
      const sceneStates: GraphState["sceneStates"] = {
        [sceneIndex]: {
          plan: scene,
          attempts: [],
          status: "failed",
        },
      };
      return { sceneStates };
    }

    publishEvent(jobId, "codegen_complete", { sceneIndex, codeLength: code.length });
    log.info({ jobId, sceneIndex, elapsed }, "CodeGen complete");

    const sceneState: SceneState = {
      plan: scene,
      attempts: [],
      status: "validating",
      finalCode: code,
    };

    return { sceneStates: { [sceneIndex]: sceneState } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, sceneIndex, err: msg }, "CodeGen error");
    return {
      sceneStates: {
        [sceneIndex]: { plan: scene, attempts: [], status: "failed" },
      },
    };
  }
}

function buildUserMessage(
  scene: ScenePlan,
  manifest: StyleManifest,
  sceneIndex: number,
  ctx?: GraphState["retrievalContext"],
  codeExamples?: CodeExample[]
): string {
  const className = `Scene${String(sceneIndex).padStart(2, "0")}`;
  const parts = [
    `Scene index: ${sceneIndex} — class name MUST be: ${className}`,
    `Scene prompt: ${scene.prompt}`,
    scene.description ? `Scene description: ${scene.description}` : "",
    scene.concepts?.length ? `Concepts: ${scene.concepts.join(", ")}` : "",
    scene.visualElements?.length ? `Visual elements: ${scene.visualElements.join(", ")}` : "",
    `Duration: ${scene.durationSec} seconds`,
    `Required Manim features: ${scene.manimFeatures.join(", ")}`,
    `Required symbols (pre-verified): ${scene.requiredSymbols.join(", ")}`,
    `\nStyleManifest:\n${JSON.stringify(manifest, null, 2)}`,
  ].filter(Boolean);

  if (codeExamples?.length) {
    parts.push(
      `\nRetrieved code examples from RAG (use these as ground truth — adapt their patterns to this scene):\n` +
        codeExamples.map((e, i) => `Example ${i + 1} — ${e.description}:\n\`\`\`python\n${e.code}\n\`\`\``).join("\n\n")
    );
  }

  if (ctx?.apiExamples?.length) {
    parts.push(
      `\nAPI examples from RAG (use these as ground truth for symbol patterns):\n` +
        ctx.apiExamples.map((e) => `${e.symbol}:\n${e.snippet}`).join("\n\n")
    );
  }
  if (ctx?.similarScripts?.length) {
    parts.push(
      `\nSimilar scripts from RAG:\n` +
        ctx.similarScripts.map((s) => `Prompt: ${s.prompt}\n${s.code}`).join("\n\n")
    );
  }

  return parts.join("\n");
}
