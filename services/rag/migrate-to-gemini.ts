#!/usr/bin/env tsx
/**
 * migrate-to-gemini.ts
 *
 * In-place re-embedding migration: replaces 1024-dim Ollama/BGE-M3 embeddings
 * with Gemini embeddings at EMBEDDING_DIM (default 3072) WITHOUT deleting any
 * docs. Preserves all runtime-generated examples (source="api_add") and
 * plugin seeds.
 *
 * Usage:
 *   EMBEDDER_PROVIDER=gemini EMBEDDER_API_KEY=<key> EMBEDDING_DIM=3072 \
 *     tsx migrate-to-gemini.ts
 *
 *   --dry-run   Print counts only, don't write anything.
 *   --batch N   Embedding batch size (default 50, Gemini free tier safe).
 *   --skip-index  Skip dropping/recreating the vector search index.
 */

import { connect, disconnect, getDb } from "./src/db.js";
import { embedBatch } from "./src/providers/embedder.js";
import { createCorpusStore } from "./src/store/mongodb.js";
import { config } from "./src/config.js";
import { log } from "./src/logger.js";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_INDEX = args.includes("--skip-index");
const batchArg = args.indexOf("--batch");
const BATCH_SIZE = batchArg >= 0 ? parseInt(args[batchArg + 1]!, 10) : 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log.info(
    { provider: config.EMBEDDER_PROVIDER, model: config.EMBEDDER_MODEL, dim: config.EMBEDDING_DIM, dryRun: DRY_RUN },
    "=== migrate-to-gemini starting ==="
  );

  await connect();
  const db = getDb();
  const coll = db.collection(config.COLLECTION_NAME);
  const store = createCorpusStore(db);

  // ── 1. Count + preview ───────────────────────────────────────────────────
  const total = await coll.countDocuments();
  const bySource = await coll.aggregate([
    { $group: { _id: "$source", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();
  log.info({ total, bySource }, "Corpus snapshot before migration");

  // Sample existing embedding dim
  const sample = await coll.findOne({}, { projection: { embedding: 1 } });
  const existingDim = Array.isArray(sample?.embedding) ? sample.embedding.length : "none";
  log.info({ existingDim, targetDim: config.EMBEDDING_DIM }, "Embedding dimensions");

  if (DRY_RUN) {
    log.info("DRY RUN — no writes. Remove --dry-run to execute.");
    await disconnect();
    return;
  }

  // ── 2. Drop the old vector index (dimension-locked — must recreate) ──────
  if (!SKIP_INDEX) {
    log.info("Dropping old vector search index...");
    await store.dropSearchIndexes();
    // Atlas index deletion is async; give it a moment before we write new dims
    log.info("Waiting 5s for Atlas to process index deletion...");
    await sleep(5000);
  }

  // ── 3. Re-embed all docs in batches ─────────────────────────────────────
  let cursor = coll.find({}, { projection: { _id: 1, id: 1, embedText: 1 } });
  const docs: Array<{ _id: any; id: string; embedText: string }> = [];
  for await (const doc of cursor) docs.push(doc as any);

  log.info({ total: docs.length, batchSize: BATCH_SIZE }, "Starting re-embedding");

  let done = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.embedText || d.id || "");

    log.info({ batch: i / BATCH_SIZE + 1, from: i, to: Math.min(i + BATCH_SIZE, docs.length) }, "Embedding batch");

    const vectors = await embedBatch(texts, "RETRIEVAL_DOCUMENT");

    // Bulk update — replace only the embedding field
    const ops = batch.map((doc, j) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { embedding: vectors[j] } },
      },
    }));
    const result = await coll.bulkWrite(ops, { ordered: false });
    done += result.modifiedCount;
    log.info({ done, total: docs.length, modifiedThisBatch: result.modifiedCount }, "Batch written");

    // Polite delay between batches to stay within Gemini free-tier rate limits
    // (1500 req/min → 50 texts/batch = 30 req/min, well within limits).
    if (i + BATCH_SIZE < docs.length) await sleep(1000);
  }

  log.info({ done, total: docs.length }, "Re-embedding complete");

  // ── 4. Recreate vector search index at new dimension ────────────────────
  if (!SKIP_INDEX) {
    log.info({ dim: config.EMBEDDING_DIM }, "Creating new vector search index...");
    await store.createVectorIndex();
    log.info("Waiting for index to become READY (up to 3 min)...");
    const ready = await store.waitForIndexReady(config.VECTOR_INDEX_NAME, 180_000);
    if (ready) {
      log.info("Vector index is READY — migration complete!");
    } else {
      log.warn("Index not READY within timeout. Check Atlas UI; queries may fail until it's ready.");
    }
  }

  // ── 5. Final stats ───────────────────────────────────────────────────────
  const finalCount = await coll.countDocuments();
  const spot = await coll.findOne({}, { projection: { embedding: 1 } });
  const finalDim = Array.isArray(spot?.embedding) ? spot.embedding.length : "none";
  log.info({ finalCount, finalDim }, "=== Migration done ===");

  await disconnect();
}

main().catch((err) => {
  log.error({ err: String(err) }, "Migration failed");
  process.exit(1);
});
