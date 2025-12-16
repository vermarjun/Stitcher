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

  publishEvent(jobId, "planner_started", { jobId });
  log.info({ jobId }, "Planner started");

  const plannerCfg = modelConfig.planner ?? {
    provider: config.defaultProvider,
    model: config.defaultModelPlanner,
  };

  const model = getModel(plannerCfg);
  const { systemPrompt } = getPrompt("planner");

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
    const result = await agent.invoke({
      messages: [new SystemMessage(systemPrompt), new HumanMessage(userContent)],
    });

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

    return { styleManifest, scenes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ jobId, err: msg }, "Planner error");
    return { error: { summary: "Planner failed", details: msg } };
  }
}

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
