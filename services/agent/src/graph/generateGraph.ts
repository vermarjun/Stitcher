/**
 * Generate graph — Planner → N parallel CodeGens → Validator+Refiner loop → Aggregate
 *
 * Fan-out pattern: after the planner completes, we dispatch one codeGenNode
 * per scene in parallel using Promise.all. Each result is merged back into
 * sceneStates. Then we run a validation+refine pass on all scenes.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation, GraphState, SceneState } from "./state.js";
import { plannerNode } from "../agents/planner.js";
import { codeGenNode } from "../agents/codeGen.js";
import { refinerNode } from "../agents/refiner.js";
import { validate } from "../validation/pipeline.js";
import { publishEvent } from "../events/emitter.js";
import { saveJob } from "./checkpointer.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("generateGraph");

// ── Node: planner ────────────────────────────────────────────────────────────

async function plannerStep(state: GraphState): Promise<Partial<GraphState>> {
  return plannerNode(state);
}

// ── Node: parallel codegen ───────────────────────────────────────────────────

async function parallelCodeGenStep(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, scenes } = state;
  if (!scenes?.length) {
    return { error: { summary: "No scenes to generate" } };
  }

  const maxParallel = Math.min(scenes.length, config.maxParallelScenes);
  const batches: number[][] = [];
  for (let i = 0; i < scenes.length; i += maxParallel) {
    batches.push(scenes.slice(i, i + maxParallel).map((_, j) => i + j));
  }

  let mergedSceneStates: GraphState["sceneStates"] = {};

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map((idx) => codeGenNode(state, idx))
    );
    for (const result of results) {
      if (result.sceneStates) {
        mergedSceneStates = { ...mergedSceneStates, ...result.sceneStates };
      }
    }
    await saveJob(jobId, { ...state, sceneStates: mergedSceneStates });
  }

  return { sceneStates: mergedSceneStates };
}

// ── Node: validate + refine ──────────────────────────────────────────────────

async function validateAndRefineStep(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, sceneStates } = state;
  const maxRetries = state.limits?.maxValidationRetries ?? config.defaultMaxValidationRetries;

  let updated = { ...sceneStates };

  for (const [idxStr, sceneState] of Object.entries(updated)) {
    const idx = parseInt(idxStr, 10);
    if (sceneState.status === "failed" || sceneState.status === "done") continue;

    const code = sceneState.finalCode;
    if (!code) {
      updated[idx] = { ...sceneState, status: "failed" };
      continue;
    }

    const expectedClass = `Scene${String(idx).padStart(2, "0")}`;

    publishEvent(jobId, "validator_started", { sceneIndex: idx, attempt: sceneState.attempts.length });

    const report = await validate(code, expectedClass);

    publishEvent(jobId, "validator_result", {
      sceneIndex: idx,
      attempt: sceneState.attempts.length,
      passed: report.passed,
      failures: Object.entries(report.checks).filter(([, v]) => v !== "ok").map(([k]) => k),
    });

    if (report.passed) {
      updated[idx] = { ...sceneState, status: "done", finalCode: code };
      continue;
    }

    // Refine loop
    let currentCode = code;
    let currentState = sceneState;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const refineResult = await refinerNode(state, idx, currentCode, report);
      if (refineResult.sceneStates?.[idx]) {
        currentState = refineResult.sceneStates[idx]!;
        currentCode = currentState.finalCode ?? currentCode;
        updated[idx] = currentState;
        if (currentState.status === "done" || currentState.status === "failed") break;
      }
    }

    if (updated[idx]!.status !== "done") {
      updated[idx] = { ...updated[idx]!, status: "failed" };
    }
  }

  return { sceneStates: updated };
}

// ── Node: aggregate ──────────────────────────────────────────────────────────

async function aggregateStep(state: GraphState): Promise<Partial<GraphState>> {
  const { jobId, sceneStates } = state;
  const allDone = Object.values(sceneStates).every((s) => s.status === "done" || s.status === "failed");
  log.info({ jobId, sceneCount: Object.keys(sceneStates).length, allDone }, "Aggregating results");
  await saveJob(jobId, state);
  return {};
}

// ── Routing ───────────────────────────────────────────────────────────────────

function afterPlanner(state: GraphState): string {
  if (state.error) return "end";
  return "parallelCodeGen";
}

// ── Build graph ───────────────────────────────────────────────────────────────

export function buildGenerateGraph() {
  const graph = new StateGraph(GraphStateAnnotation)
    .addNode("planner", plannerStep)
    .addNode("parallelCodeGen", parallelCodeGenStep)
    .addNode("validateAndRefine", validateAndRefineStep)
    .addNode("aggregate", aggregateStep)
    .addEdge(START, "planner")
    .addConditionalEdges("planner", afterPlanner, {
      parallelCodeGen: "parallelCodeGen",
      end: END,
    })
    .addEdge("parallelCodeGen", "validateAndRefine")
    .addEdge("validateAndRefine", "aggregate")
    .addEdge("aggregate", END);

  return graph.compile();
}
