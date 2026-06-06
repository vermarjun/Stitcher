/**
 * Plugin skills loader.
 *
 * Each Manim plugin we support has a short "skill" doc under src/prompts/skills/
 * (manim-<plugin>.md) describing what the plugin does, its key APIs, the canonical
 * usage pattern, and gotchas. The RAG query-transform returns `requiredPlugins`
 * (e.g. ["manim-chess"]); given those names we inject the matching skill docs into
 * the coder's user message so it knows the plugin exists and how to drive it.
 *
 * This is the ORIENTATION layer (plugin-level), complementary to:
 *   - the cheatsheet (atomic per-symbol signatures + snippets), and
 *   - the RAG examples (full composed scenes).
 *
 * Resolution mirrors the prompt registry: skill .md files land at
 * <dist>/prompts/skills/ (bind-mounted in docker, see docker-compose.services.yml).
 * Loading is lazy + cached and NEVER throws — a missing dir yields an empty block.
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("skills");

// Hard cap on how many plugin skills we inject per request (token budget guard).
const MAX_SKILLS = 3;

// ── Lazy index: canonical plugin key → skill body ──────────────────────────────

let _index: Record<string, string> | null = null;

/** Normalise a plugin name to a canonical key: drop manim prefix, lowercase. */
function canonicalKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/^manim[-_]/, "");
}

function loadIndex(): Record<string, string> {
  if (_index) return _index;
  _index = {};
  const dir = config.skillsDir;
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      try {
        const body = fs.readFileSync(path.join(dir, f), "utf8").trim();
        if (body) _index[canonicalKey(f)] = body;
      } catch {
        /* skip unreadable file */
      }
    }
    log.info({ skills: Object.keys(_index).length, dir }, "Plugin skills loaded");
  } catch (err) {
    log.warn({ dir, err: String(err) }, "Could not load plugin skills — using empty index");
  }
  return _index;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Given plugin names from RAG (`requiredPlugins`), return a formatted block of the
 * matching skill docs for injection into the coder prompt. Returns "" if none match.
 *
 * @param plugins - plugin names, any form ("manim-chess", "chess", "manim_chess").
 * @param maxSkills - cap on number of skills to include (default MAX_SKILLS).
 */
export function lookupSkills(plugins: string[], maxSkills = MAX_SKILLS): string {
  if (!plugins || plugins.length === 0) return "";

  const index = loadIndex();
  if (Object.keys(index).length === 0) return "";

  const seen = new Set<string>();
  const bodies: string[] = [];

  for (const p of plugins) {
    const key = canonicalKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    const body = index[key];
    if (body) bodies.push(body);
    if (bodies.length >= maxSkills) break;
  }

  if (bodies.length === 0) return "";

  return (
    "PLUGIN SKILLS (the request maps to these Manim plugins — STRONGLY prefer them " +
    "over re-implementing the same thing in core Manim):\n\n" +
    bodies.join("\n\n---\n\n")
  );
}

/** Number of loaded skills (diagnostics). */
export function skillsSize(): number {
  return Object.keys(loadIndex()).length;
}
