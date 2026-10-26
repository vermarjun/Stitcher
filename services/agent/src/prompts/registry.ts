/**
 * Prompt registry — maps role + version alias to the correct .md file.
 *
 * Override active version per role via env:
 *   PROMPT_VERSION_PLANNER=v1_initial
 *   PROMPT_VERSION_CODER=v1_initial
 *   etc.
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "../config.js";

type Role = "planner" | "coder" | "coder_voiceover" | "debugger" | "refiner";

interface PromptMeta {
  role: Role;
  version: number;
  name: string;
  description: string;
  expectedModels: string[];
  tokenBudget: number;
}

const PROMPTS_DIR = path.join(__dirname);

const ACTIVE_VERSIONS: Record<Role, string> = {
  planner: config.promptVersionPlanner === "active" ? "v1_initial" : config.promptVersionPlanner,
  coder: config.promptVersionCoder === "active" ? "v1_initial" : config.promptVersionCoder,
  // Voiceover coder prompt: pinned to its own file under src/prompts/coder/.
  // The role name maps to directory `coder` (shared with the legacy coder) but a
  // distinct version file, so it lives at coder/v1_voiceover.md.
  coder_voiceover: config.promptVersionCoder === "active" ? "v1_voiceover" : `${config.promptVersionCoder}_voiceover`,
  debugger: config.promptVersionDebugger === "active" ? "v1_initial" : config.promptVersionDebugger,
  refiner: config.promptVersionRefiner === "active" ? "v1_initial" : config.promptVersionRefiner,
};

// Roles whose .md files live in a different directory than the role name.
const ROLE_DIR_OVERRIDE: Partial<Record<Role, string>> = {
  coder_voiceover: "coder",
};

function parseFrontMatter(content: string): { meta: Partial<PromptMeta>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const yamlBlock = match[1]!;
  const body = match[2]!;
  const meta: Partial<PromptMeta> = {};
  for (const line of yamlBlock.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key) continue;
    const val = rest.join(":").trim();
    if (key === "version") meta.version = parseInt(val, 10);
    else if (key === "token_budget") meta.tokenBudget = parseInt(val, 10);
    else (meta as Record<string, unknown>)[key.trim()] = val.replace(/^"(.*)"$/, "$1");
  }
  return { meta, body };
}

const _cache = new Map<string, { meta: Partial<PromptMeta>; body: string }>();

export function getPrompt(role: Role): { systemPrompt: string; meta: Partial<PromptMeta> } {
  const version = ACTIVE_VERSIONS[role];
  const cacheKey = `${role}:${version}`;

  if (!_cache.has(cacheKey)) {
    const dir = ROLE_DIR_OVERRIDE[role] ?? role;
    const filePath = path.join(PROMPTS_DIR, dir, `${version}.md`);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      _cache.set(cacheKey, parseFrontMatter(content));
    } catch (err) {
      throw new Error(`Could not load prompt for role=${role} version=${version}: ${err}`);
    }
  }

  const cached = _cache.get(cacheKey)!;
  return { systemPrompt: cached.body.trim(), meta: cached.meta };
}
