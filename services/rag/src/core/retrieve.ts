import { getDb } from "../db.js";
import { createCorpusStore } from "../store/mongodb.js";
import { config } from "../config.js";
import { log } from "../logger.js";
import { withRetry, withTimeout, isTransient } from "../util/retry.js";
import type { ScoredDoc } from "../types.js";
import type { ResolvedSettings } from "./settings.js";

export interface RetrieveOutput {
  merged: ScoredDoc[];
  denseCount: number;
  sparseCount: number;
  vectorSearchMs: number;
  sparseSearchMs: number;
}

/**
 * Dense vector retrieval, plus optional sparse/BM25 retrieval fused with RRF.
 * Sparse is opt-in (STAGE_SPARSE) and degrades gracefully if the text index is
 * missing — dense results are always returned.
 */
export async function retrieve(
  queryVector: number[],
  sparseQuery: string,
  settings: ResolvedSettings
): Promise<RetrieveOutput> {
  const store = createCorpusStore(getDb());

  // ── Dense ────────────────────────────────────────────────────────────────
  const vStart = Date.now();
  const dense = await withRetry(
    () =>
      withTimeout(
        store.vectorSearch(queryVector, settings.retrieval.denseTopK, settings.retrieval.denseNumCandidates),
        settings.timeouts.vectorSearchMs,
        "vectorSearch"
      ),
    {
      retries: 1,
      baseMs: config.RETRY_BASE_MS,
      label: "vectorSearch",
      shouldRetry: isTransient,
    }
  );
  const vectorSearchMs = Date.now() - vStart;
  log.info(
    { step: "vector_search", durationMs: vectorSearchMs, candidates: dense.length, top: dense[0]?.similarity },
    "Dense retrieval complete"
  );

  // ── Sparse (optional) ──────────────────────────────────────────────────────
  let sparse: ScoredDoc[] = [];
  let sparseSearchMs = 0;
  if (settings.stages.sparse) {
    const sStart = Date.now();
    try {
      sparse = await withTimeout(
        store.textSearch(sparseQuery, settings.retrieval.sparseTopK),
        settings.timeouts.vectorSearchMs,
        "textSearch"
      );
    } catch (err) {
      log.warn({ err: String(err) }, "Sparse retrieval failed — continuing with dense only");
      sparse = [];
    }
    sparseSearchMs = Date.now() - sStart;
    log.info({ step: "sparse_search", durationMs: sparseSearchMs, candidates: sparse.length }, "Sparse retrieval complete");
  }

  const merged = sparse.length > 0 ? rrfMerge(dense, sparse, settings.retrieval.rrfK) : dense;

  return {
    merged,
    denseCount: dense.length,
    sparseCount: sparse.length,
    vectorSearchMs,
    sparseSearchMs,
  };
}

/** Reciprocal Rank Fusion of two ranked lists, keyed by doc id. */
export function rrfMerge(dense: ScoredDoc[], sparse: ScoredDoc[], k: number): ScoredDoc[] {
  const byId = new Map<string, ScoredDoc>();

  const add = (list: ScoredDoc[], field: "dense" | "sparse") => {
    list.forEach((sd, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = byId.get(sd.doc.id);
      if (existing) {
        existing.fusedScore = (existing.fusedScore ?? 0) + contribution;
        if (field === "dense") existing.similarity = sd.similarity;
        else existing.sparseScore = sd.sparseScore;
      } else {
        byId.set(sd.doc.id, {
          doc: sd.doc,
          similarity: field === "dense" ? sd.similarity : 0,
          sparseScore: field === "sparse" ? sd.sparseScore : undefined,
          fusedScore: contribution,
        });
      }
    });
  };

  add(dense, "dense");
  add(sparse, "sparse");

  return [...byId.values()].sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0));
}
