/**
 * Code graph — single-scene CodeGen → Validator+Refiner loop → END.
 *
 * Used by POST /code. The orchestrator (e.g. stitcher) supplies ONE scene plan
 * + retrieved code examples + style manifest. We run codeGen on scene index 0
 * and then validate/refine until success or retries exhausted.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation, GraphState, SceneState } from "./state.js";
import { codeGenNode } from "../agents/codeGen.js";
import { refinerNode } from "../agents/refiner.js";
import { validate } from "../validation/pipeline.js";
import { publishEvent } from "../events/emitter.js";
import { saveJob } from "./checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("codeGraph");

const SCENE_INDEX = 0;

async function codeGenStep(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.scenes?.length) {
    return { error: { summary: "No scene plan provided to /code" } };
  }
  if (!state.styleManifest) {
    return { error: { summary: "No styleManifest provided to /code" } };
  }
  return codeGenNode(state, SCENE_INDEX);
}

async function validateAndRefineStep(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, sceneStates } = state;
  const maxRetries = state.limits?.maxValidationRetries ?? config.defaultMaxValidationRetries;

  const sceneState = sceneStates[SCENE_INDEX];
  if (!sceneState) {
    return { error: { summary: "CodeGen produced no scene state" } };
  }
  if (sceneState.status === "failed" || sceneState.status === "done") {
    return { sceneStates: { [SCENE_INDEX]: sceneState } };
  }

  const code = sceneState.finalCode;
  if (!code) {
    const failed: SceneState = { ...sceneState, status: "failed" };
    return { sceneStates: { [SCENE_INDEX]: failed } };
  }

  const expectedClass = `Scene${String(SCENE_INDEX).padStart(2, "0")}`;
  publishEvent(jobId, "validator_started", { sceneIndex: SCENE_INDEX, attempt: sceneState.attempts.length });

  const report = await validate(code, expectedClass);
  publishEvent(jobId, "validator_result", {
    sceneIndex: SCENE_INDEX,
    attempt: sceneState.attempts.length,
    passed: report.passed,
    failures: Object.entries(report.checks).filter(([, v]) => v !== "ok").map(([k]) => k),
  });

  if (report.passed) {
    return { sceneStates: { [SCENE_INDEX]: { ...sceneState, status: "done", finalCode: code } } };
  }

  let currentCode = code;
  let currentState: SceneState = sceneState;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const refineResult = await refinerNode(state, SCENE_INDEX, currentCode, report);
    if (refineResult.sceneStates?.[SCENE_INDEX]) {
      currentState = refineResult.sceneStates[SCENE_INDEX]!;
      currentCode = currentState.finalCode ?? currentCode;
      if (currentState.status === "done" || currentState.status === "failed") break;
    }
  }

  if (currentState.status !== "done") {
    currentState = { ...currentState, status: "failed" };
  }

  return { sceneStates: { [SCENE_INDEX]: currentState } };
}

async function finalizeStep(state: GraphState): Promise<Partial<GraphState>> {
  log.info({ jobId: state.jobId, status: state.sceneStates[SCENE_INDEX]?.status }, "Code job finalised");
  await saveJob(state.jobId, state);
  return {};
}

export function buildCodeGraph() {
  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("codeGen", codeGenStep)
    .addNode("validateAndRefine", validateAndRefineStep)
    .addNode("finalize", finalizeStep)
    .addEdge(START, "codeGen")
    .addEdge("codeGen", "validateAndRefine")
    .addEdge("validateAndRefine", "finalize")
    .addEdge("finalize", END);

  return graph.compile();
}
