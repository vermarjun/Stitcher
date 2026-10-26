/**
 * Debug graph — Debugger → Validator loop → END
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation, GraphState } from "./state.js";
import { debuggerNode } from "../agents/debugger.js";
import { saveJob } from "./checkpointer.js";
import { getLogger } from "../logging.js";

const log = getLogger("debugGraph");

async function debugStep(state: GraphState): Promise<Partial<GraphState>> {
  return debuggerNode(state);
}

async function finalizeStep(state: GraphState): Promise<Partial<GraphState>> {
  log.info({ jobId: state.jobId }, "Debug job finalised");
  await saveJob(state.jobId, state);
  return {};
}

function afterDebug(state: GraphState): string {
  if (state.error && !state.fixedCode) return "end";
  return "finalize";
}

export function buildDebugGraph() {
  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("debugger", debugStep)
    .addNode("finalize", finalizeStep)
    .addEdge(START, "debugger")
    .addConditionalEdges("debugger", afterDebug, {
      finalize: "finalize",
      end: END,
    })
    .addEdge("finalize", END);

  return graph.compile();
}
