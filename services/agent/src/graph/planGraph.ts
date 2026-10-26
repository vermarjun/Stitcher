/**
 * Plan graph — Planner → END.
 *
 * Single-node graph that runs the planner and returns scenes + styleManifest.
 * Used by POST /plan, exposed for the stitcher to call before per-scene
 * RAG retrieval.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation, GraphState } from "./state.js";
import { plannerNode } from "../agents/planner.js";
import { saveJob } from "./checkpointer.js";

async function plannerStep(state: GraphState): Promise<Partial<GraphState>> {
  return plannerNode(state);
}

async function finalizeStep(state: GraphState): Promise<Partial<GraphState>> {
  await saveJob(state.jobId, state);
  return {};
}

function afterPlanner(state: GraphState): string {
  if (state.error) return "end";
  return "finalize";
}

export function buildPlanGraph() {
  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("planner", plannerStep)
    .addNode("finalize", finalizeStep)
    .addEdge(START, "planner")
    .addConditionalEdges("planner", afterPlanner, {
      finalize: "finalize",
      end: END,
    })
    .addEdge("finalize", END);

  return graph.compile();
}
