import { log } from "../logger.js";
import type { ScoredDoc } from "../types.js";

// ── Relevance floor ────────────────────────────────────────────────────────
// Coverage-greedy maximises DISTINCT API coverage, which for a focused single-
// domain prompt (e.g. "london chess opening") will happily pull in off-domain
// examples PRECISELY BECAUSE they add new APIs (a chemistry scene, an optics
// scene). That is the "RAG fetched junk" symptom. The fix: before the greedy
// pass, drop candidates whose DENSE similarity is far below the best match, so
// the diversity optimisation only ever runs over genuinely-relevant examples.
//
// Floors are scale-aware: keep anything within REL_FLOOR of the top similarity,
// and never keep anything below ABS_FLOOR (clearly unrelated). A minItems
// backfill guarantees we never starve the coder — worst case equals the old
// behaviour.
const ABS_FLOOR = 0.35; // absolute dense-cosine minimum (below ⇒ unrelated)
const REL_FLOOR = 0.55; // keep candidates within 55% of the best similarity

/** Apply the relevance floor, backfilling by similarity to guarantee minItems. */
function applyRelevanceFloor(candidates: ScoredDoc[], minItems: number): ScoredDoc[] {
  const simOf = (c: ScoredDoc) => c.similarity ?? 0;
  const topSim = candidates.reduce((m, c) => Math.max(m, simOf(c)), 0);
  // If we have no usable dense signal at all (e.g. sparse-only), skip the floor.
  if (topSim <= 0) return candidates;

  const floor = Math.max(ABS_FLOOR, topSim * REL_FLOOR);
  const relevant = candidates.filter((c) => simOf(c) >= floor);

  if (relevant.length >= minItems) return relevant;

  // Backfill from the cut candidates (highest similarity first) up to minItems.
  const relevantSet = new Set(relevant);
  const extra = candidates
    .filter((c) => !relevantSet.has(c))
    .sort((a, b) => simOf(b) - simOf(a))
    .slice(0, minItems - relevant.length);
  return [...relevant, ...extra];
}

/**
 * Coverage-greedy selection. Per CONTRACT 1:
 *
 * Instead of LLM reranking, pick the final 5–10 examples by greedily maximising
 * distinct `apisUsed` coverage:
 *   1. Pick the highest-scoring candidate not yet selected.
 *   2. Score each remaining candidate by how many NEW (uncovered) APIs it adds.
 *   3. Break ties by the original retrieval score.
 *   4. Repeat until `maxItems` selected or the pool is exhausted.
 *
 * Goal: the returned set covers many DIFFERENT APIs, not near-duplicates that
 * all use the same primitives.  Rule-based, no LLM. A relevance floor is applied
 * FIRST so diversity is maximised only over relevant examples.
 *
 * Returns `{ selected, coveredApis, ran: true }` (ran=true mirrors the old
 * reranker shape so the pipeline span attribute stays consistent).
 */
export function selectDiverse(
  rawCandidates: ScoredDoc[],
  maxItems: number = 8,
  minItems: number = 5
): { selected: ScoredDoc[]; coveredApis: string[]; ran: boolean } {
  if (rawCandidates.length === 0) {
    return { selected: [], coveredApis: [], ran: false };
  }

  // Drop off-domain candidates before the diversity pass (with minItems backfill).
  const candidates = applyRelevanceFloor(rawCandidates, minItems);
  if (candidates.length < rawCandidates.length) {
    log.info(
      { step: "select", floorDropped: rawCandidates.length - candidates.length, kept: candidates.length },
      "Relevance floor removed off-domain candidates"
    );
  }

  // Work on a copy sorted by retrieval score (best first) so the greedy loop
  // can fall back to this order when API-coverage is tied.
  const scoreOf = (sd: ScoredDoc) => sd.rerankScore ?? sd.fusedScore ?? sd.similarity ?? 0;
  const pool = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a));

  // RELEVANCE-FIRST selection.
  //
  // Pure coverage-greedy ranked by DISTINCT api coverage and only used the
  // retrieval score as a tiebreaker — so for a focused query it discarded the
  // most-relevant examples in favour of off-domain ones that happened to add
  // "new" APIs. Real failure: a chess query retrieved 4 chess scenes at the top
  // (sim 0.72–0.77), and the selector threw ALL of them out for a chemistry /
  // ML / astronomy set (sim ~0.68) because those added more distinct APIs.
  //
  // Fix: anchor the majority of slots by pure relevance (so correctly-retrieved
  // on-domain examples are NEVER dropped), then use coverage-greedy ONLY to fill
  // the remaining tail slots for breadth. assemble() trims to topK afterwards, so
  // the examples the coder actually sees are the most-relevant ones, in order.
  const anchorN = Math.min(pool.length, Math.max(minItems, Math.ceil(maxItems * 0.7)));
  const selected: ScoredDoc[] = pool.slice(0, anchorN);
  const covered = new Set<string>();
  for (const sd of selected) for (const a of sd.doc.apisUsed ?? []) covered.add(a);

  // Diversify the tail: from the not-yet-selected pool, greedily add whichever
  // contributes the most NEW apis (tiebreak by relevance) until maxItems.
  const remaining = pool.slice(anchorN);
  while (selected.length < maxItems && remaining.length > 0) {
    let bestIdx = -1;
    let bestNewApis = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const sd = remaining[i]!;
      const newApis = (sd.doc.apisUsed ?? []).filter((a) => !covered.has(a)).length;
      const score = scoreOf(sd);
      if (newApis > bestNewApis || (newApis === bestNewApis && score > bestScore)) {
        bestIdx = i;
        bestNewApis = newApis;
        bestScore = score;
      }
    }
    if (bestIdx === -1) break;
    const [chosen] = remaining.splice(bestIdx, 1);
    selected.push(chosen!);
    for (const a of chosen!.doc.apisUsed ?? []) covered.add(a);
  }

  const coveredApis = [...covered];
  log.info(
    {
      step: "select",
      in: candidates.length,
      out: selected.length,
      anchored: anchorN,
      coveredApis: coveredApis.length,
      topScore: (selected[0]?.similarity ?? 0).toFixed(4),
    },
    "Relevance-first selection complete"
  );

  return { selected, coveredApis, ran: true };
}
