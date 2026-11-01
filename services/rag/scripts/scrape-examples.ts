#!/usr/bin/env tsx
/**
 * Dataset expansion — scrape full Manim Community v0.19 scene examples.
 *
 * Sources (each best-effort; one failing source never aborts the run):
 *   1. Mined from data/chunks_all.json `exampleCode` (full Scene classes).
 *   2. GitHub ManimCommunity/manim `example_scenes/*.py` (raw).
 *   3. ManimCommunity docs `.. manim:: Name` RST code blocks (examples + tutorials).
 *
 * Pipeline: extract → dedupe (normalized code hash) → validate parse
 *   (`python3` compile, syntax-only) → optional LLM description enrichment
 *   (--enrich, uses the high-quota reranker model) → write data/expanded_examples.json
 *
 * Usage:
 *   npx tsx scripts/scrape-examples.ts [--enrich] [--limit N] [--out PATH]
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

// ─── Config / args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ENRICH = args.includes("--enrich");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1]!, 10) : Infinity;
})();
const OUT = (() => {
  const i = args.indexOf("--out");
  return i >= 0 ? args[i + 1]! : fileURLToPath(new URL("../data/expanded_examples.json", import.meta.url));
})();
const CHUNKS_PATH = fileURLToPath(new URL("../data/chunks_all.json", import.meta.url));

const RST_SOURCES = [
  "https://raw.githubusercontent.com/ManimCommunity/manim/v0.19.0/docs/source/examples.rst",
  "https://raw.githubusercontent.com/ManimCommunity/manim/v0.19.0/docs/source/tutorials/quickstart.rst",
  "https://raw.githubusercontent.com/ManimCommunity/manim/v0.19.0/docs/source/tutorials/building_blocks.rst",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScriptRecord {
  id: string;
  sceneClassName: string;
  title: string;
  description: string;
  code: string;
  apisUsed: string[];
  animationTypes: string[];
  domain: string;
  category: string;
  tags: string[];
  complexity: "beginner" | "intermediate" | "expert";
  colorPalette: string[];
  quality: number;
  manimVersion: string;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchText(url: string, ms = 20000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      console.warn(`  ! ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ! ${url} → ${String(err)}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

const ANIMATION_NAMES = [
  "Create", "Uncreate", "FadeIn", "FadeOut", "Write", "Unwrite", "DrawBorderThenFill",
  "Transform", "ReplacementTransform", "TransformFromCopy", "MoveToTarget", "Rotate",
  "GrowArrow", "GrowFromCenter", "GrowFromPoint", "SpinInFromNothing", "ScaleInPlace",
  "Indicate", "Flash", "Circumscribe", "ShowPassingFlash", "FocusOn", "ApplyWave", "Wiggle",
  "AnimationGroup", "Succession", "LaggedStart", "LaggedStartMap", "ApplyMethod", "ApplyFunction",
];

// Known Manim API symbols, seeded from the scraped chunks (classNames + methods).
let KNOWN_APIS: Set<string> = new Set(ANIMATION_NAMES);
function loadKnownApis(): void {
  try {
    const chunks = JSON.parse(readFileSync(CHUNKS_PATH, "utf-8")) as any[];
    for (const c of chunks) {
      if (c.className) KNOWN_APIS.add(c.className);
      if (Array.isArray(c.methodNames)) for (const m of c.methodNames) KNOWN_APIS.add(m);
    }
  } catch {
    /* fall back to the animation list only */
  }
}

function detectApis(code: string): string[] {
  const found = new Set<string>();
  // Symbols used as constructors / animations: `Name(` patterns.
  for (const m of code.matchAll(/\b([A-Z][A-Za-z0-9]+)\s*\(/g)) {
    if (KNOWN_APIS.has(m[1]!)) found.add(m[1]!);
  }
  return [...found];
}

function detectAnimations(code: string): string[] {
  return ANIMATION_NAMES.filter((a) => new RegExp(`\\b${a}\\b`).test(code));
}

function detectColors(code: string): string[] {
  const colors = new Set<string>();
  for (const m of code.matchAll(/#[0-9A-Fa-f]{6}\b/g)) colors.add(m[0].toUpperCase());
  return [...colors].slice(0, 8);
}

function detectDomain(code: string, name: string): string {
  const t = (code + " " + name).toLowerCase();
  if (/(sort|search|graph|tree|array|stack|queue|algorithm|binary|neural|node)/.test(t)) return "cs";
  if (/(matrix|vector|integral|deriv|fourier|sine|cosine|theorem|equation|geometry|circle|triangle)/.test(t)) return "math";
  if (/(force|velocity|wave|particle|pendulum|gravity|orbit|physics)/.test(t)) return "physics";
  return "general";
}

function detectCategory(code: string): string {
  if (/ThreeDScene|ThreeDAxes|Surface|Sphere|Cube|Cylinder/.test(code)) return "scenes";
  if (/Axes|NumberPlane|NumberLine|BarChart|plot\(/.test(code)) return "mobjects";
  return "scenes";
}

function complexityOf(code: string): "beginner" | "intermediate" | "expert" {
  const lines = code.split("\n").length;
  if (/ThreeDScene|always_redraw|add_updater|ValueTracker/.test(code) || lines > 90) return "expert";
  if (lines > 40) return "intermediate";
  return "beginner";
}

function humanize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

function ensureImports(code: string): string {
  return /from manim import|import manim/.test(code) ? code : `from manim import *\n\n${code}`;
}

function normalizeForHash(code: string): string {
  return code
    .replace(/#.*$/gm, "")
    .replace(/"""[\s\S]*?"""/g, "")
    .replace(/'''[\s\S]*?'''/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function firstDocstringOrComment(code: string): string {
  const doc = code.match(/def construct\(self\):\s*(?:"""|''')([\s\S]*?)(?:"""|''')/);
  if (doc) return doc[1]!.trim().split("\n")[0]!.trim();
  const comment = code.match(/#\s*(.+)/);
  return comment ? comment[1]!.trim() : "";
}

function heuristicDescription(name: string, code: string, apis: string[]): string {
  const human = humanize(name);
  const hint = firstDocstringOrComment(code);
  const apiPart = apis.length ? ` It uses ${apis.slice(0, 10).join(", ")}.` : "";
  const base = `A Manim scene "${human}" that demonstrates ${human.toLowerCase()}.`;
  return `${hint ? hint + " " : ""}${base}${apiPart}`.replace(/\s+/g, " ").trim();
}

// ─── Scene-class extraction ─────────────────────────────────────────────────

/** Pull every top-level `class X(...Scene...):` block out of a Python file. */
function extractSceneClasses(py: string): Array<{ name: string; code: string }> {
  const lines = py.split("\n");
  const out: Array<{ name: string; code: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i]!.match(/^class\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (m && /Scene/.test(m[2]!)) {
      const name = m[1]!;
      const body: string[] = [lines[i]!];
      i++;
      while (i < lines.length && !/^class\s+\w+\s*\(/.test(lines[i]!) && !/^[A-Za-z@]/.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      out.push({ name, code: body.join("\n").replace(/\s+$/, "") });
    } else {
      i++;
    }
  }
  return out;
}

/** Extract `.. manim:: Name` directive code blocks from RST. */
function extractManimDirectives(rst: string): Array<{ name: string; code: string }> {
  const lines = rst.split("\n");
  const out: Array<{ name: string; code: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\.\.\s+manim::\s*(\w+)/);
    if (!m) continue;
    const name = m[1]!;
    // Skip option lines (":hide_source:" etc.) and blanks, then capture the
    // indented code body until indentation returns to column 0.
    let j = i + 1;
    const body: string[] = [];
    let started = false;
    let baseIndent = -1;
    while (j < lines.length) {
      const line = lines[j]!;
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;
      if (!started) {
        if (trimmed === "" || trimmed.startsWith(":")) { j++; continue; }
        baseIndent = indent;
        started = true;
      }
      if (trimmed !== "" && indent < baseIndent) break;
      body.push(started ? line.slice(baseIndent) : line);
      j++;
    }
    const code = body.join("\n").replace(/\s+$/, "");
    if (/class\s+\w+\s*\(.*Scene/.test(code)) out.push({ name, code });
    i = j - 1;
  }
  return out;
}

// ─── Collectors ────────────────────────────────────────────────────────────

function collectFromChunks(): ScriptRecord[] {
  let chunks: any[];
  try {
    chunks = JSON.parse(readFileSync(CHUNKS_PATH, "utf-8"));
  } catch (err) {
    console.warn(`  ! could not read chunks: ${String(err)}`);
    return [];
  }
  const recs: ScriptRecord[] = [];
  for (const c of chunks) {
    const code: string | null = c.exampleCode;
    if (!code || !/class\s+\w+\s*\(.*Scene/.test(code)) continue;
    const cls = extractSceneClasses(code);
    for (const sc of cls) recs.push(makeRecord(sc.name, sc.code, "manim_docs:example", 4));
  }
  return recs;
}

async function collectFromGithub(): Promise<ScriptRecord[]> {
  const recs: ScriptRecord[] = [];
  const listing = await fetchText("https://api.github.com/repos/ManimCommunity/manim/contents/example_scenes");
  let files: string[] = ["basic.py", "customtex.py", "advanced_tex_fonts.py"];
  if (listing) {
    try {
      const parsed = JSON.parse(listing) as any[];
      files = parsed.filter((f) => f.name?.endsWith(".py")).map((f) => f.name);
    } catch { /* use default list */ }
  }
  for (const f of files) {
    const py = await fetchText(`https://raw.githubusercontent.com/ManimCommunity/manim/v0.19.0/example_scenes/${f}`);
    if (!py) continue;
    for (const sc of extractSceneClasses(py)) recs.push(makeRecord(sc.name, sc.code, `github:ManimCommunity/manim/example_scenes/${f}`, 5));
  }
  return recs;
}

async function collectFromRst(): Promise<ScriptRecord[]> {
  const recs: ScriptRecord[] = [];
  for (const url of RST_SOURCES) {
    const rst = await fetchText(url);
    if (!rst) continue;
    const source = `manim_docs:${url.split("/").slice(-1)[0]}`;
    for (const blk of extractManimDirectives(rst)) recs.push(makeRecord(blk.name, blk.code, source, 5));
  }
  return recs;
}

function makeRecord(name: string, rawCode: string, source: string, quality: number): ScriptRecord {
  const code = ensureImports(rawCode.trim());
  const apis = detectApis(code);
  const tags = humanize(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return {
    id: `script_${source.replace(/[^a-z0-9]+/gi, "_")}_${name}`.toLowerCase().slice(0, 120),
    sceneClassName: name,
    title: humanize(name),
    description: heuristicDescription(name, code, apis),
    code,
    apisUsed: apis,
    animationTypes: detectAnimations(code),
    domain: detectDomain(code, name),
    category: detectCategory(code),
    tags,
    complexity: complexityOf(code),
    colorPalette: detectColors(code),
    quality,
    manimVersion: "0.19.0",
    source,
  };
}

// ─── Validation (parse check via python3) ────────────────────────────────────

function validateParses(recs: ScriptRecord[]): ScriptRecord[] {
  const payload = JSON.stringify(Object.fromEntries(recs.map((r) => [r.id, r.code])));
  const py = `
import sys, json
data = json.load(sys.stdin)
ok = []
for k, code in data.items():
    try:
        compile(code, k, "exec")
        ok.append(k)
    except Exception:
        pass
print(json.dumps(ok))
`;
  const res = spawnSync("python3", ["-c", py], { input: payload, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0 || !res.stdout) {
    console.warn(`  ! python validation unavailable (${res.stderr?.slice(0, 120) ?? "no python3"}) — skipping parse check`);
    return recs;
  }
  const okIds = new Set<string>(JSON.parse(res.stdout));
  const passed = recs.filter((r) => okIds.has(r.id));
  console.log(`  parse check: ${passed.length}/${recs.length} valid`);
  return passed;
}

// ─── Optional LLM description enrichment ─────────────────────────────────────

async function enrichDescriptions(recs: ScriptRecord[]): Promise<void> {
  const { chatText } = await import("../src/providers/llm.js");
  const { config } = await import("../src/config.js");
  const { resolveSettings } = await import("../src/core/settings.js");
  const target = resolveSettings().reranker; // high-quota model, env-configured
  let done = 0;
  const concurrency = 4;
  let idx = 0;
  async function worker() {
    while (idx < recs.length) {
      const r = recs[idx++]!;
      try {
        const { result: desc } = await chatText({
          target,
          timeoutMs: config.RERANK_TIMEOUT_MS,
          messages: [
            {
              role: "user",
              content:
                `Describe, in ONE concise sentence (max 40 words), what this Manim scene animates ` +
                `(focus on the visual/concept, not the code). Reply with only the sentence.\n\n` +
                "```python\n" + r.code.slice(0, 2000) + "\n```",
            },
          ],
        });
        const clean = desc.trim().replace(/^["']|["']$/g, "");
        if (clean.length > 10) r.description = `${clean} (uses ${r.apisUsed.slice(0, 8).join(", ")})`;
      } catch { /* keep heuristic description */ }
      done++;
      if (done % 20 === 0) console.log(`  enriched ${done}/${recs.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  loadKnownApis();
  console.log(`Known Manim API symbols: ${KNOWN_APIS.size}`);

  console.log("Collecting from chunk exampleCode…");
  const fromChunks = collectFromChunks();
  console.log(`  ${fromChunks.length} scene classes mined`);

  console.log("Collecting from GitHub example_scenes…");
  const fromGithub = await collectFromGithub();
  console.log(`  ${fromGithub.length} scene classes`);

  console.log("Collecting from docs RST (.. manim:: blocks)…");
  const fromRst = await collectFromRst();
  console.log(`  ${fromRst.length} scene classes`);

  // Dedupe by normalized code hash (prefer higher quality / official sources first).
  const all = [...fromGithub, ...fromRst, ...fromChunks];
  const seen = new Set<string>();
  const deduped: ScriptRecord[] = [];
  for (const r of all) {
    const h = crypto.createHash("sha1").update(normalizeForHash(r.code)).digest("hex");
    if (seen.has(h)) continue;
    seen.add(h);
    deduped.push(r);
  }
  console.log(`Deduped: ${deduped.length} / ${all.length}`);

  let valid = validateParses(deduped);
  if (Number.isFinite(LIMIT)) valid = valid.slice(0, LIMIT);

  if (ENRICH) {
    console.log(`Enriching ${valid.length} descriptions via LLM…`);
    await enrichDescriptions(valid);
  }

  writeFileSync(OUT, JSON.stringify(valid, null, 2));
  console.log(`\nWrote ${valid.length} examples → ${OUT}`);
  console.log(`  by source:`, countBy(valid, (r) => r.source.split(":")[0]!));
  console.log(`  by domain:`, countBy(valid, (r) => r.domain));
  console.log(`  by complexity:`, countBy(valid, (r) => r.complexity));
}

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of arr) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
