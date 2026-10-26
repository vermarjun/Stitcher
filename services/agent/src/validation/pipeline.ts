/**
 * Deterministic validation pipeline — no LLM.
 *
 * Checks (in order, fail-fast):
 *   1. ast        — Python syntax (via Python subprocess)
 *   2. apiSurface — every Manim symbol exists in the installed version
 *   3. pyflakes   — undefined names, unused imports
 *   4. ruff       — style/bug rules (Manim-tuned config)
 *   5. compile    — Python compile() catches bytecode-level issues
 *   6. manimLint  — custom rules: no subprocess, socket, etc.
 *   7. sceneClass — expected Scene class present
 *
 * Returns a ValidationReport. Never throws.
 */

import { spawn } from "child_process";
import * as path from "path";
import { ValidationReport } from "../graph/state.js";
import { checkSymbolsSync } from "../tools/manimApiCheck.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("validator");

const RUNNER_PATH = path.join(__dirname, "runner.py");

type CheckResult = "ok" | { error: string; line?: number; suggestion?: string };

async function runPythonChecks(
  code: string,
  checks: string[],
  expectedClass?: string,
  voiceoverNarration?: string[]
): Promise<{ results: Record<string, { status: string; error?: string; line?: number; suggestion?: string }>; failFast: string | null }> {
  return new Promise((resolve) => {
    const proc = spawn(
      config.pythonPath,
      [RUNNER_PATH],
      { timeout: 30_000 }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("error", (err) => {
      log.warn({ err: err.message }, "Validator runner failed to start");
      resolve({ results: {}, failFast: "validator_unavailable" });
    });

    proc.on("close", (code_: number | null) => {
      if (code_ !== 0) {
        log.warn({ code: code_, stderr }, "Validator runner exited non-zero");
      }
      try {
        resolve(JSON.parse(stdout.trim()) as { results: Record<string, { status: string; error?: string; line?: number; suggestion?: string }>; failFast: string | null });
      } catch {
        resolve({ results: {}, failFast: "validator_unavailable" });
      }
    });

    proc.stdin.write(
      JSON.stringify({
        code,
        checks,
        ruffConfigPath: config.ruffConfigPath,
        expectedClass,
        ...(voiceoverNarration ? { voiceoverNarration } : {}),
      })
    );
    proc.stdin.end();
  });
}

export async function validate(
  code: string,
  expectedSceneClass?: string,
  voiceoverNarration?: string[]
): Promise<ValidationReport> {
  const checks: Record<string, CheckResult> = {};
  let failFast: string | null = null;

  // ── 2. API surface (pure TS, no subprocess needed) ────────────────────────
  // Extract Manim symbols referenced in the code (heuristic: capitalised words used as callees)
  const symbolPattern = /\b([A-Z][A-Za-z0-9_]+)\s*[(\[]/g;
  const candidates = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = symbolPattern.exec(code)) !== null) {
    const sym = m[1]!;
    // Skip obvious non-Manim names
    if (!["Scene", "True", "False", "None", "Exception", "ValueError"].includes(sym)) {
      candidates.add(sym);
    }
  }

  const { missing } = checkSymbolsSync(Array.from(candidates));
  // We don't fail-fast on this alone — the model may use valid symbols not in our index
  if (missing.length > 0) {
    log.debug({ missing }, "Possible unknown symbols (non-fatal at index check)");
  }

  // ── Python checks: ast, pyflakes, ruff, compile, manimLint, sceneClass ────
  // When voiceover narration beats are supplied, also run the beat-equality check
  // (voiceoverBeats). When absent, behavior is unchanged.
  const pythonChecks = ["ast", "pyflakes", "ruff", "compile", "manimLint", "sceneClass"];
  if (voiceoverNarration && voiceoverNarration.length > 0) {
    pythonChecks.push("voiceoverBeats");
  }
  const { results, failFast: pyFailFast } = await runPythonChecks(
    code,
    pythonChecks,
    expectedSceneClass,
    voiceoverNarration
  );

  for (const [name, result] of Object.entries(results)) {
    if (result.status === "ok" || result.status === "skip") {
      checks[name] = "ok";
    } else if (result.status === "fail") {
      checks[name] = {
        error: result.error ?? "unknown error",
        line: result.line,
        suggestion: result.suggestion,
      };
    }
  }

  if (pyFailFast) {
    failFast = pyFailFast;
  }

  const passed = failFast === null && Object.values(checks).every((v) => v === "ok");

  return { passed, checks, failFast };
}
