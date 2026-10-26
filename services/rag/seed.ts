#!/usr/bin/env tsx
/**
 * ManimRAG seed / admin CLI.
 *
 *   tsx seed.ts                 — embed + upsert the full corpus (idempotent; skips existing ids)
 *   tsx seed.ts --reset         — DROP the search index(es) + collection, re-seed from scratch
 *   tsx seed.ts stats           — print corpus counts (by docType / category / domain)
 *   tsx seed.ts health          — run the component health check
 *
 * Flags: --file <path> (extra script JSON), --no-api, --no-scripts
 *
 * Corpus sources:
 *   - ipynb/output/chunks_all.json      → docType "api"    (Manim API reference)
 *   - data/seed_examples.json           → docType "script" (curated full scenes)
 *   - data/expanded_examples.json       → docType "script" (scraped, run `npm run scrape` first)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect, disconnect, getDb } from "./src/db.js";
import { createCorpusStore } from "./src/store/mongodb.js";
import { embedBatch } from "./src/providers/embedder.js";
import { runHealthCheck } from "./src/core/health.js";
import { config } from "./src/config.js";
import { log } from "./src/logger.js";
import type { Complexity, CorpusDoc, CorpusDocWithEmbedding } from "./src/types.js";

// ─── Paths ────────────────────────────────────────────────────────────────────
const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const CHUNKS = p("../ipynb/output/chunks_all.json");
const SEED_SCRIPTS = p("./data/seed_examples.json");
const EXPANDED_SCRIPTS = p("./data/expanded_examples.json");

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) ?? "seed";
const RESET = args.includes("--reset");
const NO_API = args.includes("--no-api");
const NO_SCRIPTS = args.includes("--no-scripts");
const extraFile = (() => {
  const i = args.indexOf("--file");
  return i >= 0 ? args[i + 1] : undefined;
})();

// ─── Normalizers ───────────────────────────────────────────────────────────────

function levelToComplexity(level?: string): Complexity {
  if (level === "module") return "expert";
  if (level === "class") return "intermediate";
  return "beginner";
}

function deriveApis(chunk: any): string[] {
  const apis = new Set<string>();
  if (chunk.className) apis.add(chunk.className);
  if (chunk.methodName) apis.add(`${chunk.className}.${chunk.methodName}`);
  if (Array.isArray(chunk.methodNames)) for (const m of chunk.methodNames) apis.add(`${chunk.className}.${m}`);
  return [...apis];
}

function deriveTags(chunk: any): string[] {
  const tags = new Set<string>();
  if (chunk.category) tags.add(chunk.category);
  if (chunk.module) for (const part of String(chunk.module).split(".")) if (part.length > 2) tags.add(part);
  if (chunk.className) tags.add(chunk.className);
  if (chunk.level) tags.add(chunk.level);
  return [...tags];
}

const ANIMATION_NAMES = [
  "Create", "Uncreate", "FadeIn", "FadeOut", "Write", "Transform", "ReplacementTransform",
  "MoveToTarget", "Rotate", "GrowArrow", "GrowFromCenter", "Indicate", "Flash", "Circumscribe",
  "AnimationGroup", "Succession", "LaggedStart",
];
function detectAnimations(text: string): string[] {
  return ANIMATION_NAMES.filter((a) => text.includes(a));
}

function apiChunkToDoc(chunk: any): CorpusDoc {
  const content: string = chunk.content ?? "";
  const sig = content.match(/Signature:\s*(.+)/);
  return {
    id: `api_${chunk.id}`,
    docType: "api",
    embedText: content,
    title: chunk.fullyQualifiedName ?? chunk.className ?? chunk.module ?? chunk.id,
    content,
    code: chunk.exampleCode ?? "",
    signature: sig ? sig[1]!.trim() : undefined,
    fullyQualifiedName: chunk.fullyQualifiedName,
    apisUsed: deriveApis(chunk),
    animationTypes: detectAnimations(content + (chunk.exampleCode ?? "")),
    category: chunk.category ?? "general",
    domain: "general",
    level: chunk.level,
    tags: deriveTags(chunk),
    complexity: levelToComplexity(chunk.level),
    quality: 4,
    colorPalette: [],
    manimVersion: chunk.manimVersion ?? "0.19.0",
    source: "manim_docs",
    createdAt: new Date().toISOString(),
  };
}

function scriptToDoc(s: any, idPrefix: string, source: string): CorpusDoc {
  const description: string = s.description ?? s.originalPrompt ?? s.title ?? "";
  const apisUsed: string[] = s.apisUsed ?? [];
  const embedText = `${description}\nManim APIs: ${apisUsed.join(", ")}`.trim();
  const name = s.sceneClassName ?? s.title ?? s.id;
  return {
    id: s.id?.startsWith("script_") ? s.id : `${idPrefix}_${s.id ?? name}`,
    docType: "script",
    embedText,
    title: s.title ?? name,
    content: description,
    code: s.code ?? "",
    fullyQualifiedName: undefined,
    apisUsed,
    animationTypes: s.animationTypes ?? detectAnimations(s.code ?? ""),
    category: s.category ?? "scenes",
    domain: s.domain ?? "general",
    tags: s.tags ?? [],
    complexity: (s.complexity as Complexity) ?? "intermediate",
    quality: s.quality ?? 4,
    colorPalette: s.colorPalette ?? [],
    manimVersion: s.manimVersion ?? "0.19.0",
    source: s.source ?? source,
    createdAt: new Date().toISOString(),
  };
}

function loadJson(path: string): any[] {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    log.warn({ path, err: String(err) }, "Failed to parse JSON source");
    return [];
  }
}

function buildCorpus(): CorpusDoc[] {
  const docs: CorpusDoc[] = [];

  if (!NO_API) {
    const chunks = loadJson(CHUNKS);
    for (const c of chunks) docs.push(apiChunkToDoc(c));
    log.info({ count: chunks.length }, "Loaded API chunks");
  }

  if (!NO_SCRIPTS) {
    const seed = loadJson(SEED_SCRIPTS);
    for (const s of seed) docs.push(scriptToDoc(s, "script_seed", "seed"));
    log.info({ count: seed.length }, "Loaded seed scripts");

    const expanded = loadJson(EXPANDED_SCRIPTS);
    for (const s of expanded) docs.push(scriptToDoc(s, "script_expanded", "scraped"));
    log.info({ count: expanded.length }, "Loaded expanded (scraped) scripts");

    if (extraFile) {
      const extra = loadJson(extraFile);
      for (const s of extra) docs.push(scriptToDoc(s, "script_extra", "extra"));
      log.info({ count: extra.length }, "Loaded extra scripts");
    }
  }

  // De-dupe by id (later wins).
  const byId = new Map<string, CorpusDoc>();
  for (const d of docs) byId.set(d.id, d);
  return [...byId.values()];
}

// ─── Commands ──────────────────────────────────────────────────────────────────

async function runSeed() {
  const corpus = buildCorpus();
  const apiN = corpus.filter((d) => d.docType === "api").length;
  const scriptN = corpus.filter((d) => d.docType === "script").length;
  log.info({ total: corpus.length, api: apiN, scripts: scriptN }, "Corpus built");
  if (corpus.length === 0) {
    log.error("Empty corpus — nothing to seed");
    process.exit(1);
  }

  await connect();
  const store = createCorpusStore(getDb());

  if (RESET) {
    log.info("--reset: dropping search index(es) and all documents…");
    await store.dropSearchIndexes();
    const deleted = await store.deleteAll();
    log.info({ deleted }, "Collection cleared");
  }

  // Idempotency: skip docs already present (unless --reset wiped them).
  let toEmbed = corpus;
  if (!RESET) {
    const existing = await store.existingIds(corpus.map((d) => d.id));
    toEmbed = corpus.filter((d) => !existing.has(d.id));
    log.info({ existing: existing.size, toEmbed: toEmbed.length }, "Idempotent skip applied");
  }

  // Embed in batches with backoff + key rotation (inside embedBatch).
  const batchSize = config.EMBED_BATCH_SIZE;
  let embedded = 0;
  let written = 0;
  const t0 = Date.now();
  for (let i = 0; i < toEmbed.length; i += batchSize) {
    const batch = toEmbed.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map((d) => d.embedText || d.title));
    const withEmb: CorpusDocWithEmbedding[] = batch.map((d, j) => ({ ...d, embedding: vectors[j]! }));
    written += await store.bulkUpsert(withEmb);
    embedded += batch.length;
    const pct = ((embedded / toEmbed.length) * 100).toFixed(1);
    log.info(
      { embedded, total: toEmbed.length, pct: `${pct}%`, elapsedMs: Date.now() - t0 },
      "Embedding progress"
    );
  }
  log.info({ embedded, written, ms: Date.now() - t0 }, "Embedding + upsert complete");

  // Create indexes (idempotent) and wait until queryable.
  log.info("Ensuring Atlas Vector Search index…");
  await store.createVectorIndex();
  if (config.STAGE_SPARSE) {
    log.info("STAGE_SPARSE enabled — ensuring Atlas text (BM25) index…");
    await store.createTextIndex();
  }
  log.info("Waiting for vector index to become READY (build can take 1–2 min)…");
  await store.waitForIndexReady(config.VECTOR_INDEX_NAME);
  if (config.STAGE_SPARSE) await store.waitForIndexReady(config.TEXT_INDEX_NAME);

  const stats = await store.stats();
  log.info({ stats }, "Seed complete ✓");
  await disconnect();
}

async function runStats() {
  await connect();
  const store = createCorpusStore(getDb());
  const stats = await store.stats();
  console.log(JSON.stringify(stats, null, 2));
  await disconnect();
}

async function runHealth() {
  await connect();
  const result = await runHealthCheck();
  console.log(JSON.stringify(result, null, 2));
  await disconnect();
  process.exit(result.status === "error" ? 1 : 0);
}

async function main() {
  switch (command) {
    case "seed":
      await runSeed();
      break;
    case "stats":
      await runStats();
      break;
    case "health":
      await runHealth();
      break;
    default:
      console.error(`Unknown command: ${command}. Use: seed | stats | health`);
      process.exit(1);
  }
}

main().catch(async (err) => {
  log.error({ err: String(err) }, "Seed CLI failed");
  try {
    await disconnect();
  } catch { /* ignore */ }
  process.exit(1);
});
