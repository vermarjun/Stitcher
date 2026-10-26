/**
 * Cheatsheet lookup tool.
 *
 * Loads manim_cheatsheet.json (core + 6 plugin symbols) at startup.
 * Given an array of symbol names from RAG, returns a compact formatted block
 * suitable for injection into the coder system prompt.
 *
 * Format per entry (stub-style):
 *   SymbolName(signature) — description
 *   import: <exact import line>
 *   example:
 *     <2-6 line snippet>
 *
 * Caps output at MAX_ENTRIES entries (de-duplicated) to stay within token budget.
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("cheatsheet");

// ── Types ────────────────────────────────────────────────────────────────────

export interface CheatsheetEntry {
  name: string;
  source: string; // "manim" | plugin name
  import: string;
  signature: string;
  kind: string;
  bases: string[];
  description: string;
  example: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

// config.manimCheatsheetPath always has a value (uses opt() fallback).
// The secondary fallback here handles edge-cases where config is not available;
// __dirname in the compiled output is dist/tools, so we go up one level to dist/assets.
const CHEATSHEET_PATH = config.manimCheatsheetPath ?? path.join(__dirname, "..", "assets", "manim_cheatsheet.json");
const MAX_ENTRIES = 25;

// ── Lazy index ────────────────────────────────────────────────────────────────

let _index: Record<string, CheatsheetEntry> | null = null;

function loadIndex(): Record<string, CheatsheetEntry> {
  if (_index) return _index;
  try {
    const raw = fs.readFileSync(CHEATSHEET_PATH, "utf8");
    _index = JSON.parse(raw) as Record<string, CheatsheetEntry>;
    log.info({ symbols: Object.keys(_index).length }, "Manim cheatsheet loaded");
  } catch (err) {
    log.warn({ path: CHEATSHEET_PATH, err }, "Could not load cheatsheet — using empty index");
    _index = {};
  }
  return _index;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up symbols in the cheatsheet and return a formatted block.
 *
 * @param symbols - Array of symbol names to look up (from RAG apiExamples, requiredSymbols, etc.)
 * @param maxEntries - Maximum number of entries to include (default: MAX_ENTRIES)
 * @returns A formatted string block for prompt injection, or empty string if no matches.
 */
export function lookupCheatsheet(symbols: string[], maxEntries = MAX_ENTRIES): string {
  if (symbols.length === 0) return "";

  const index = loadIndex();
  if (Object.keys(index).length === 0) return "";

  // De-duplicate while preserving order
  const seen = new Set<string>();
  const entries: CheatsheetEntry[] = [];

  for (const sym of symbols) {
    if (seen.has(sym)) continue;
    seen.add(sym);

    const entry = index[sym];
    if (!entry) continue;

    entries.push(entry);
    if (entries.length >= maxEntries) break;
  }

  if (entries.length === 0) return "";

  // Group by source for a slightly cleaner header
  const lines: string[] = [
    `API Cheat Sheet (${entries.length} symbol${entries.length === 1 ? "" : "s"} — verified signatures + examples):`,
  ];

  for (const e of entries) {
    const sourceLabel = e.source === "manim" ? "manim core" : e.source;
    const sigLine = `${e.name}${e.signature} — ${e.description || "no description"}`;
    const exampleIndented = e.example
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");

    lines.push(
      `\n[${sourceLabel}] ${sigLine}`,
      `  import: ${e.import}`,
      `  example:\n${exampleIndented}`
    );
  }

  return lines.join("\n");
}

/**
 * Look up a single symbol. Returns null if not found.
 */
export function getCheatsheetEntry(symbol: string): CheatsheetEntry | null {
  const index = loadIndex();
  return index[symbol] ?? null;
}

/**
 * Return the count of loaded symbols (for diagnostics).
 */
export function cheatsheetSize(): number {
  return Object.keys(loadIndex()).length;
}
