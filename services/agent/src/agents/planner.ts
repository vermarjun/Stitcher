/**
 * Planner agent node.
 *
 * Input:  GraphState with prompt, constraints, userPreferences, retrievalContext
 * Output: GraphState update with styleManifest + scenes[]
 *
 * Tools: manim_api_check, web_search (if enabled)
 * Emits: planner_started, planner_tool_call, planner_tool_result, planner_complete
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, StyleManifest, ScenePlan } from "../graph/state.js";
import { getModel } from "../models/factory.js";
import { manimApiCheckTool } from "../tools/manimApiCheck.js";
import { createWebSearchTool } from "../tools/webSearch.js";
import { getPrompt } from "../prompts/registry.js";
import { publishEvent } from "../events/emitter.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";
import { withGenAiSpan, getLangfuseCallbacks, takeLastUsage } from "../observability/llm.js";

const log = getLogger("planner");

function extractJsonBlock(text: string, tag: string): unknown | null {
  const re = new RegExp("```(?:json)\\s+" + tag + "\\s*\\n([\\s\\S]*?)```", "i");
  const match = text.match(re);
  if (!match) return null;
  try {
    return JSON.parse(match[1]!.trim());
  } catch {
    return null;
  }
}

export async function plannerNode(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, prompt, constraints, userPreferences, retrievalContext, modelConfig } = state;
  const voiceover = state.voiceover === true;

  publishEvent(jobId, "planner_started", { jobId, voiceover });
  log.info({ jobId, voiceover }, "Planner started");

  const plannerCfg = modelConfig.planner ?? {
    provider: config.defaultProvider,
    model: config.defaultModelPlanner,
  };

  const model = getModel(plannerCfg);
  const { systemPrompt: basePrompt } = getPrompt("planner");
  // When voiceover is ON, append the strict narration instruction block so each
  // scene carries an ordered `narration: string[]`. When OFF, the prompt is
  // byte-for-byte identical to the legacy prompt (no narration emitted).
  const systemPrompt = voiceover ? basePrompt + "\n\n" + PLANNER_VOICEOVER_BLOCK : basePrompt;

  const tools = [
    manimApiCheckTool,
    ...(config.enableWebSearch ? [createWebSearchTool(jobId)] : []),
  ];

  const agent = createReactAgent({ llm: model, tools });

  // Build the user message
  const userContent = [
    `Prompt: ${prompt}`,
    constraints ? `Constraints: ${JSON.stringify(constraints)}` : "",
    userPreferences ? `User preferences: ${JSON.stringify(userPreferences)}` : "",
    retrievalContext?.styleRecommendations?.length
      ? `Style recommendations from RAG: ${retrievalContext.styleRecommendations.join(", ")}`
      : "",
    retrievalContext?.pitfalls?.length
      ? `Known pitfalls: ${retrievalContext.pitfalls.join(", ")}`
      : "",
    state.styleManifestOverride
      ? `IMPORTANT: Use this style manifest exactly (do not regenerate one):\n${JSON.stringify(state.styleManifestOverride)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await withGenAiSpan("planner", plannerCfg, () =>
      agent.invoke(
        { messages: [new SystemMessage(systemPrompt), new HumanMessage(userContent)] },
        { callbacks: getLangfuseCallbacks("planner", { traceId: state.traceId, jobId }) }
      )
    );
    const usage = takeLastUsage();

    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content);

    // Extract structured outputs
    const styleManifest = state.styleManifestOverride ??
      (extractJsonBlock(responseText, "style_manifest") as StyleManifest | null) ??
      defaultStyleManifest(userPreferences);

    const scenes = extractJsonBlock(responseText, "scene_plan") as ScenePlan[] | null;

    if (!scenes || scenes.length === 0) {
      log.error({ jobId, responseText: responseText.slice(0, 500) }, "Planner failed to produce scene plan");
      return {
        error: { summary: "Planner did not produce a valid scene plan", details: responseText.slice(0, 1000) },
      };
    }

    // Voiceover contract: every scene MUST carry a non-empty `narration: string[]`
    // of plain spoken beats. If the planner omitted it, fail loudly rather than
    // silently producing a scene the coder cannot mechanically follow.
    if (voiceover) {
      const bad = scenes.filter(
        (s) => !Array.isArray(s.narration) || s.narration.length === 0 || s.narration.some((b) => typeof b !== "string" || b.trim().length === 0)
      );
      if (bad.length > 0) {
        log.error({ jobId, badIndices: bad.map((s) => s.index) }, "Planner: missing/empty narration with voiceover on");
        return {
          error: {
            summary: "Planner did not emit valid narration beats for every scene (voiceover mode)",
            details: `Scenes missing a non-empty narration string[]: ${bad.map((s) => s.index).join(", ")}`,
          },
        };
      }
    }

    // Log tool calls from agent messages
    for (const msg of result.messages) {
      if (msg.getType?.() === "tool") {
        publishEvent(jobId, "planner_tool_result", { tool: (msg as { name?: string }).name ?? "unknown" });
      }
    }

    publishEvent(jobId, "planner_complete", {
      sceneCount: scenes.length,
      styleManifest,
    });

    log.info({ jobId, sceneCount: scenes.length }, "Planner complete");

    return { styleManifest, scenes, ...(usage ? { llmCallLog: [usage] } : {}) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, err: msg }, "Planner error");
    return { error: { summary: "Planner failed", details: msg } };
  }
}

// ── Voiceover planner instruction block ──────────────────────────────────────
// Appended to the planner system prompt ONLY when voiceover mode is ON. Kept here
// (not in the .md) so the legacy prompt file is untouched and voiceover:false is
// byte-for-byte unchanged. The strictness here is intentional and load-bearing:
// the coder follows these beats MECHANICALLY and reproduces them VERBATIM, so the
// planner must emit clean, final, spoken-ready strings.
export const PLANNER_VOICEOVER_BLOCK = `## VOICEOVER MODE IS ON — narration is MANDATORY

For EVERY scene you output, you MUST add one extra field: \`narration\`, a JSON array of strings.

\`narration\` is an ORDERED list of the EXACT spoken-narration beats for that scene — one beat per intended animation step. These exact strings are spoken aloud by a text-to-speech engine and are reproduced CHARACTER-FOR-CHARACTER by the code generator inside the video, so they are FINAL, not a sketch.

Hard rules for every beat string (NON-NEGOTIABLE):
1. Each beat is a complete, natural, spoken sentence (or at most two short sentences) — the way a narrator would actually say it out loud.
2. Beats are ORDERED to match the visual steps of the scene, first beat = first animation, and so on.
3. PLAIN SPOKEN TEXT ONLY. No markdown, no bullets, no numbering, no asterisks, no headings, no quotes around the whole beat, no stage directions, no parentheticals like "(pause)" or "[on screen: ...]", no speaker labels. Just the words to be spoken.
4. The NUMBER of beats roughly matches the number of distinct animation steps in the scene (typically 2–5 beats). Do not cram everything into one beat; do not split a single thought across many tiny beats.
5. The TOTAL spoken length must be consistent with \`durationSec\` — assume a natural narration pace of roughly 2.5 to 3 spoken words per second. A 10-second scene is about 25–30 spoken words total across its beats.
6. Spell things out for speech: say "x squared" not "x^2", "equals" not "=", "the function f of x" not "f(x)". Avoid symbols, LaTeX, code, or anything a TTS engine would mispronounce.
7. Self-contained per scene — never say "as we saw before" or reference other scenes.

Output the \`narration\` array as an additional field inside each scene object in the \`scene_plan\` JSON block. Example of ONE scene WITH narration:

\`\`\`json scene_plan
[
  {
    "index": 0,
    "prompt": "Show a sorted array and introduce binary search",
    "description": "An array of numbered boxes appears, then the middle element is highlighted",
    "concepts": ["binary search", "sorted array"],
    "visualElements": ["array of boxes", "highlighted middle element"],
    "durationSec": 9,
    "manimFeatures": ["VGroup", "Create", "Indicate"],
    "requiredSymbols": ["Scene", "VGroup", "Create", "Indicate"],
    "narration": [
      "Here is a sorted array of numbers, laid out from smallest to largest.",
      "Binary search works by repeatedly looking at the middle element to decide which half to keep."
    ]
  }
]
\`\`\`

The \`narration\` field is REQUIRED on every scene while voiceover mode is on. Do not omit it. Do not leave it empty.`;

function defaultStyleManifest(prefs?: { primaryColor?: string; backgroundColor?: string }): StyleManifest {
  return {
    primaryColor: prefs?.primaryColor ?? "#3B82F6",
    secondaryColor: "#10B981",
    backgroundColor: prefs?.backgroundColor ?? "#1a1a2e",
    accentColor: "#F59E0B",
    fontFamily: "sans-serif",
    animationPace: "medium",
    positioningZones: { title: "UP * 3", main: "ORIGIN", subtitle: "DOWN * 2.5" },
    elementNaming: { title: "title_text", equation: "eq", graph: "axes" },
  };
}
