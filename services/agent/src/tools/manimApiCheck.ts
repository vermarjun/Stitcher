/**
 * manimApiCheck — confirms symbols exist in the installed Manim version.
 *
 * Loads the pre-built manim_api_index.json at startup (built by
 * scripts/build_manim_api_index.py at container build time).
 * Returns { valid, missing, suggestions } for each queried symbol.
 */

import * as fs from "fs";
import { tool } from "@langchain/core/tools";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("manimApiCheck");

interface ApiEntry {
  signature: string | null;
  doc: string | null;
  module: string;
}

let _index: Record<string, ApiEntry> | null = null;

function loadIndex(): Record<string, ApiEntry> {
  if (_index) return _index;
  try {
    const raw = fs.readFileSync(config.manimApiIndexPath, "utf8");
    _index = JSON.parse(raw) as Record<string, ApiEntry>;
    log.info({ symbols: Object.keys(_index).length }, "Manim API index loaded");
    return _index;
  } catch (err) {
    log.warn({ path: config.manimApiIndexPath, err }, "Could not load manim API index — using empty set");
    _index = {};
    return _index;
  }
}

/** Synchronous symbol check — used directly by the validator without tool overhead. */
export function checkSymbolsSync(symbols: string[]): { valid: boolean; missing: string[] } {
  const index = loadIndex();
  const missing = symbols.filter((s) => !(s in index));
  return { valid: missing.length === 0, missing };
}

/** LangChain tool — given to planner and coder agents. */
// JSON Schema instead of zod: zod 3.25 + @langchain/core 0.3.80 make tsc blow up (TS2589, multi-GB heap).
export const manimApiCheckTool = tool(
  async (input): Promise<string> => {
    const { symbols } = input as { symbols: string[] };
    const index = loadIndex();
    const results = symbols.map((sym) => {
      if (sym in index) {
        return {
          symbol: sym,
          exists: true,
          signature: index[sym]!.signature,
          module: index[sym]!.module,
        };
      }
      // Fuzzy suggestion: case-insensitive partial match
      const lower = sym.toLowerCase();
      const suggestions = Object.keys(index)
        .filter((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()))
        .slice(0, 3);
      return { symbol: sym, exists: false, suggestions };
    });

    const missing = results.filter((r) => !r.exists).map((r) => r.symbol);
    return JSON.stringify({ valid: missing.length === 0, missing, results });
  },
  {
    name: "manim_api_check",
    description:
      "Check whether Manim symbols (class names, functions) exist in the installed version. " +
      "Call this before finalising requiredSymbols in a scene plan or before emitting code. " +
      "Returns { valid, missing, results } where results includes suggestions for missing symbols.",
    schema: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "List of Manim symbol names to verify, e.g. ['Scene', 'MathTex', 'Axes']",
        },
      },
      required: ["symbols"],
    } as const,
  }
);
