/**
 * CI regression guard for the native-voiceover validator logic.
 *
 * These tests drive the REAL production path: pipeline.ts `validate()` ->
 * Python subprocess `runner.py`. That exercises `check_voiceover_beats` and the
 * security `check_manim_lint` exactly the way the agent does at runtime.
 *
 * Note: `pyflakes`/`ruff` may not be installed in CI — runner.py reports those
 * as "skip" and the pipeline maps "skip" -> "ok", so the assertions below stay
 * deterministic regardless of whether those binaries are present.
 */

process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";
process.env["MANIM_API_INDEX_PATH"] = require("path").join(
  __dirname,
  "../../src/assets/manim_api_index.json"
);

import { validate } from "../../src/validation/pipeline";

const NARRATION = [
  "Here is a sorted array of numbers.",
  "Binary search looks at the middle element to decide which half to keep.",
];

function scene(beats: string[], opts: { voiceover?: boolean; cls?: string } = {}): string {
  const cls = opts.cls ?? "Scene00";
  if (opts.voiceover === false) {
    return [
      "from manim import *",
      "",
      `class ${cls}(Scene):`,
      "    def construct(self):",
      "        self.add(Text('hello'))",
      "",
    ].join("\n");
  }
  const blocks = beats
    .map(
      (b) =>
        `        with self.voiceover(text=${JSON.stringify(b)}) as tracker:\n` +
        `            self.play(Write(Text('x')), run_time=tracker.duration)`
    )
    .join("\n");
  return [
    "from manim import *",
    "from manim_voiceover import VoiceoverScene",
    "from stitcher_voiceover import OfflineTTS",
    "",
    `class ${cls}(VoiceoverScene):`,
    "    def construct(self):",
    "        self.set_speech_service(OfflineTTS(), create_subcaption=False)",
    blocks,
    "",
  ].join("\n");
}

function vbError(report: Awaited<ReturnType<typeof validate>>): string {
  const v = report.checks["voiceoverBeats"];
  if (v === "ok" || v === undefined) return "";
  return v.error;
}

describe("voiceover validator — check_voiceover_beats (via pipeline -> runner.py)", () => {
  it("exact-match beats + VoiceoverScene -> PASS", async () => {
    const report = await validate(scene(NARRATION), "Scene00", NARRATION);
    expect(report.checks["voiceoverBeats"]).toBe("ok");
    expect(report.failFast).toBeNull();
    expect(report.passed).toBe(true);
  });

  it("one beat reworded -> FAIL, error lists missing/altered beats", async () => {
    const reworded = [NARRATION[0]!, "Binary search checks the center element each time."];
    const report = await validate(scene(reworded), "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("voiceoverBeats");
    const err = vbError(report);
    expect(err).toMatch(/voiceover narration drift/i);
    expect(err).toMatch(/MISSING/);
    expect(err).toMatch(/EXTRA\/ALTERED/);
    // the original (dropped) beat is listed as missing; the reworded one as extra
    expect(err).toContain("middle element to decide");
    expect(err).toContain("center element each time");
  });

  it("a beat passed as an f-string / variable (non-literal) -> FAIL (plain string literal)", async () => {
    const code = [
      "from manim import *",
      "from manim_voiceover import VoiceoverScene",
      "from stitcher_voiceover import OfflineTTS",
      "",
      "class Scene00(VoiceoverScene):",
      "    def construct(self):",
      "        self.set_speech_service(OfflineTTS(), create_subcaption=False)",
      `        beat = ${JSON.stringify(NARRATION[0])}`,
      "        with self.voiceover(text=f'{beat}') as tracker:",
      "            self.play(Write(Text('x')), run_time=tracker.duration)",
      `        with self.voiceover(text=${JSON.stringify(NARRATION[1])}) as tracker:`,
      "            self.play(Write(Text('y')), run_time=tracker.duration)",
      "",
    ].join("\n");
    const report = await validate(code, "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("voiceoverBeats");
    expect(vbError(report)).toMatch(/plain string literal/i);
  });

  it("block count != beat count (extra and missing) -> FAIL on count", async () => {
    // Same SET of beats, but one beat duplicated -> count (3) != narration (2).
    const extra = [NARRATION[0]!, NARRATION[1]!, NARRATION[0]!];
    const report = await validate(scene(extra), "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("voiceoverBeats");
    expect(vbError(report)).toMatch(/block count .* does not match/i);
  });

  it("same count but a duplicated + a missing beat (set-equality) -> FAIL", async () => {
    // count is 2 == narration 2, but beat[1] is missing and beat[0] duplicated.
    const dup = [NARRATION[0]!, NARRATION[0]!];
    const report = await validate(scene(dup), "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("voiceoverBeats");
    const err = vbError(report);
    expect(err).toMatch(/voiceover narration drift/i);
    expect(err).toMatch(/MISSING/);
    expect(err).toContain("middle element to decide");
  });

  it("whitespace-padded + NFC-variant beat -> PASS (normalization)", async () => {
    // é = 'e' + combining acute (NFD); normalize_text NFC-composes to 'é'.
    const narration = ["café menu", "second beat here"];
    const inCode = ["   café   menu  ", "second   beat\there"];
    const report = await validate(scene(inCode), "Scene00", narration);
    expect(report.checks["voiceoverBeats"]).toBe("ok");
    expect(report.passed).toBe(true);
  });

  it("voiceover OFF / no narration -> voiceoverBeats SKIPPED and a plain Scene passes", async () => {
    const report = await validate(scene([], { voiceover: false }), "Scene00");
    // The check is never run (not in the python check list) so it is absent.
    expect(report.checks["voiceoverBeats"]).toBeUndefined();
    expect(report.passed).toBe(true);
    expect(report.failFast).toBeNull();
  });

  it("security regression guard: import socket -> still REJECTED", async () => {
    const code = scene(NARRATION).replace(
      "from manim import *",
      "from manim import *\nimport socket"
    );
    const report = await validate(code, "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("manimLint");
    const v = report.checks["manimLint"];
    expect(v).not.toBe("ok");
    expect((v as { error: string }).error).toMatch(/socket/);
  });

  it("security regression guard: import subprocess -> still REJECTED", async () => {
    const code = scene(NARRATION).replace(
      "from manim import *",
      "from manim import *\nimport subprocess"
    );
    const report = await validate(code, "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("manimLint");
  });

  it("security regression guard: os.system(...) -> still REJECTED", async () => {
    const code = scene(NARRATION).replace(
      "self.set_speech_service(OfflineTTS(), create_subcaption=False)",
      "self.set_speech_service(OfflineTTS(), create_subcaption=False)\n        os.system('ls')"
    );
    const report = await validate(code, "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("manimLint");
  });

  it("security regression guard: eval(...) -> still REJECTED", async () => {
    const code = scene(NARRATION).replace(
      "self.set_speech_service(OfflineTTS(), create_subcaption=False)",
      "self.set_speech_service(OfflineTTS(), create_subcaption=False)\n        eval('1+1')"
    );
    const report = await validate(code, "Scene00", NARRATION);
    expect(report.passed).toBe(false);
    expect(report.failFast).toBe("manimLint");
  });
});
