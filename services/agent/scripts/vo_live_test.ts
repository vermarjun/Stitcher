/**
 * Live voiceover smoke test — exercises the REAL configured LLM provider
 * (OpenCodeGo) through the actual planner + codeGen nodes + validator.
 *
 * Usage:
 *   npx tsx scripts/vo_live_test.ts plan "<prompt>" <maxScenes>
 *   npx tsx scripts/vo_live_test.ts code '<scenePlanJSON>' '<styleManifestJSON>'
 *   npx tsx scripts/vo_live_test.ts full "<prompt>" <maxScenes>   # plan -> code each scene -> validate
 */
import * as fs from "fs";
import { plannerNode } from "../src/agents/planner.js";
import { codeGenNode } from "../src/agents/codeGen.js";
import { validate } from "../src/validation/pipeline.js";
import { GraphState, ScenePlan, StyleManifest } from "../src/graph/state.js";

function baseState(extra: Partial<GraphState>): GraphState {
  return {
    jobId: "vo-live-" + Date.now(),
    mode: "generate",
    voiceover: true,
    traceId: undefined,
    prompt: undefined,
    constraints: undefined,
    limits: undefined,
    retrievalContext: undefined,
    userPreferences: undefined,
    styleManifestOverride: undefined,
    brokenCode: undefined,
    brokenError: undefined,
    originalPrompt: undefined,
    previousAttempts: undefined,
    modelConfig: {},
    styleManifest: undefined,
    scenes: undefined,
    codeExamples: undefined,
    sceneStates: {},
    fixedCode: undefined,
    fixedValidation: undefined,
    changeSummary: undefined,
    diff: undefined,
    events: [],
    llmCallLog: [],
    messages: [],
    error: undefined,
    ...extra,
  } as GraphState;
}

async function doPlan(prompt: string, maxScenes: number, voiceover: boolean) {
  const state = baseState({
    prompt,
    voiceover,
    constraints: { maxScenes },
  });
  const out = await plannerNode(state);
  return out;
}

async function doCode(scene: ScenePlan, manifest: StyleManifest, voiceover: boolean) {
  const state = baseState({
    voiceover,
    scenes: [{ ...scene, index: 0 }],
    styleManifest: manifest,
  });
  const out = await codeGenNode(state, 0);
  const code = out.sceneStates?.[0]?.finalCode;
  return code;
}

function emit(obj: unknown) {
  const out = JSON.stringify(obj, null, 2);
  const dest = process.env["VO_OUT"];
  if (dest) fs.writeFileSync(dest, out);
  else console.log(out);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === "plan") {
    const prompt = rest[0]!;
    const maxScenes = parseInt(rest[1] ?? "2", 10);
    const voiceover = (rest[2] ?? "true") === "true";
    const out = await doPlan(prompt, maxScenes, voiceover);
    emit({ error: out.error, styleManifest: out.styleManifest, scenes: out.scenes });
    return;
  }

  if (cmd === "full") {
    const prompt = rest[0]!;
    const maxScenes = parseInt(rest[1] ?? "2", 10);
    const voiceover = (rest[2] ?? "true") === "true";
    console.error("=== PLAN (voiceover=" + voiceover + ") ===");
    const planOut = await doPlan(prompt, maxScenes, voiceover);
    if (planOut.error || !planOut.scenes) {
      emit({ stage: "plan", error: planOut.error });
      return;
    }
    const manifest = planOut.styleManifest!;
    const results: unknown[] = [];
    for (const scene of planOut.scenes) {
      console.error(`=== CODE scene ${scene.index} (beats=${scene.narration?.length ?? 0}) ===`);
      const code = await doCode(scene, manifest, voiceover);
      let report = null;
      if (code) {
        // doCode normalizes the plan to index 0 (mirrors the /code endpoint), so
        // the generated class is Scene00. Validate against that.
        const expectedClass = "Scene00";
        report = await validate(code, expectedClass, voiceover ? scene.narration : undefined);
      }
      results.push({
        index: scene.index,
        narration: scene.narration,
        code,
        validation: report,
      });
    }
    emit({ styleManifest: manifest, results });
    return;
  }

  console.error("unknown cmd");
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
