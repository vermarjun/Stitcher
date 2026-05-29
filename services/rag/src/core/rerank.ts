import { chatText } from "../providers/llm.js";
import { log } from "../logger.js";
import { withTimeout } from "../util/retry.js";
import type { ScoredDoc } from "../types.js";
import type { ResolvedSettings } from "./settings.js";

function docText(sd: ScoredDoc, maxChars: number): string {
  const parts = [sd.doc.title, sd.doc.content || sd.doc.embedText];
  if (sd.doc.apisUsed.length) parts.push(`APIs: ${sd.doc.apisUsed.slice(0, 12).join(", ")}`);
  return parts.join(" — ").replace(/\s+/g, " ").slice(0, maxChars);
}

/**
 * LLM-as-reranker (pointwise relevance scoring). Opt-in via STAGE_RERANK.
 * Capped at RERANK_CANDIDATES with truncated doc text to stay within the
 * latency budget. On any failure, falls back to the incoming (vector/RRF)
 * ordering — retrieval never breaks because of the reranker.
 *
 * Returns { ranked, ran } where `ran` reflects whether the LLM actually scored.
 */
export async function rerank(
  query: string,
  candidates: ScoredDoc[],
  settings: ResolvedSettings
): Promise<{ ranked: ScoredDoc[]; ran: boolean }> {
  if (!settings.stages.rerank || candidates.length <= 1) {
    return { ranked: candidates, ran: false };
  }

  const pool = candidates.slice(0, settings.retrieval.rerankCandidates);
  const numbered = pool.map((sd, i) => `[${i}] ${docText(sd, settings.retrieval.rerankDocChars)}`).join("\n");

  const prompt =
    `You are a search-relevance ranker for Manim animation knowledge. ` +
    `Score how well each DOCUMENT helps answer the QUERY, from 0.0 (irrelevant) to 1.0 (highly relevant).\n\n` +
    `QUERY:\n${query}\n\nDOCUMENTS:\n${numbered}\n\n` +
    `Respond with ONLY a compact JSON array, one object per document: ` +
    `[{"index": <number>, "score": <0..1>}]. Include every index exactly once. No prose, no markdown.`;

  try {
    const raw = await withTimeout(
      chatText({
        target: settings.reranker,
        messages: [{ role: "user", content: prompt }],
        timeoutMs: settings.timeouts.rerankMs,
      }),
      settings.timeouts.rerankMs,
      "rerank"
    );

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`no JSON array in reranker response: ${raw.slice(0, 160)}`);
    const parsed: Array<{ index: number; score: number }> = JSON.parse(match[0]);

    const scored = parsed
      .filter(
        (r) =>
          typeof r?.index === "number" &&
          r.index >= 0 &&
          r.index < pool.length &&
          typeof r?.score === "number"
      )
      .map((r) => ({ ...pool[r.index]!, rerankScore: r.score }));

    if (scored.length === 0) throw new Error("reranker returned no valid scores");

    scored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
    log.info(
      { step: "rerank", in: pool.length, out: scored.length, top: scored[0]?.rerankScore },
      "Rerank complete"
    );
    return { ranked: scored, ran: true };
  } catch (err) {
    log.warn({ err: String(err) }, "Reranker failed — falling back to retrieval order");
    return { ranked: pool, ran: false };
  }
}
