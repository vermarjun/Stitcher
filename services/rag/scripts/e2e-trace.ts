#!/usr/bin/env tsx
/**
 * One-off end-to-end trace: runs every pipeline stage explicitly and dumps the
 * intermediate output + latency + token usage of each step to a markdown file.
 * All stages forced ON so every step is observable.
 *
 *   npx tsx scripts/e2e-trace.ts "<prompt>" [outfile.md]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect, disconnect, getDb } from "../src/db.js";
import { createCorpusStore } from "../src/store/mongodb.js";
import { resolveSettings } from "../src/core/settings.js";
import { assemble } from "../src/core/assemble.js";
import { config } from "../src/config.js";
import type { ScoredDoc, TransformedQuery } from "../src/types.js";

const PROMPT =
  process.argv[2] ??
  "Explain binary search with a proper example on this array: 2 8 9 3 44 81 92 45 and searching for element 81";
const OUT = process.argv[3] ?? fileURLToPath(new URL("../../E2E_TRACE.md", import.meta.url));

// Force every stage on so all intermediate outputs are visible; generous LLM
// timeouts so the slow OpenCode calls complete rather than fall back.
const settings = resolveSettings({
  stages: { queryTransform: true, sparse: false, rerank: true, pitfalls: true },
  retrieval: { rerankCandidates: 10 },
  timeouts: { queryTransformMs: 30000, rerankMs: 40000 },
});

const md: string[] = [];
const W = (s = "") => md.push(s);
const fence = (lang: string, body: string) => W("```" + lang + "\n" + body + "\n```");

async function postChat(target: any, body: any, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t = Date.now();
  try {
    const res = await fetch(`${target.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.apiKey}` },
      body: JSON.stringify({ model: target.model, ...(target.extraBody ?? {}), ...body }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    return { json, ms: Date.now() - t };
  } finally {
    clearTimeout(timer);
  }
}

function l2(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

async function main() {
  const startedAt = new Date().toISOString();
  const totals = { ms: 0, promptTokens: 0, completionTokens: 0 };

  W(`# ManimRAG — end-to-end trace`);
  W();
  W(`**Generated:** ${startedAt}`);
  W();
  W(`**Input prompt:**`);
  fence("text", PROMPT);
  W();
  W(`**Pipeline config for this run** (all stages forced ON):`);
  fence(
    "json",
    JSON.stringify(
      {
        embedder: { provider: config.EMBEDDER_PROVIDER, model: config.EMBEDDER_MODEL, dim: config.EMBEDDING_DIM },
        llm: { model: settings.llm.model, baseUrl: settings.llm.baseUrl, extraBody: settings.llm.extraBody },
        reranker: { model: settings.reranker.model, extraBody: settings.reranker.extraBody },
        stages: settings.stages,
        retrieval: settings.retrieval,
        store: config.VECTOR_STORE,
      },
      null,
      2
    )
  );
  W();
  W(`> Note: the array \`2 8 9 3 44 81 92 45\` is unsorted; binary search requires a sorted array. ` +
    `ManimRAG only grounds the request — handling that caveat is the downstream code-gen model's job.`);
  W();
  W(`---`);

  await connect();
  const store = createCorpusStore(getDb());

  // ─── STEP 1: Query transformation ──────────────────────────────────────────
  W(`## Step 1 — Query transformation  (\`core/query-transform.ts\`, model: ${settings.llm.model})`);
  W();
  W(`Rewrites the casual prompt into an API-specific description via a forced tool call (structured output).`);
  W();
  const sysPrompt = readFileSync(fileURLToPath(new URL("../prompts/query-transformer.txt", import.meta.url)), "utf-8");
  const transformSchema = {
    type: "object",
    properties: {
      transformedQuery: { type: "string" },
      suggestedApis: { type: "array", items: { type: "string" } },
      domain: { type: "string", enum: ["cs", "math", "physics", "biology", "chemistry", "general"] },
      tags: { type: "array", items: { type: "string" } },
      estimatedComplexity: { type: "string", enum: ["beginner", "intermediate", "expert"] },
    },
    required: ["transformedQuery", "suggestedApis", "domain", "tags", "estimatedComplexity"],
  };
  const tcRes = await postChat(
    settings.llm,
    {
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Transform this Manim animation request into a technical, API-specific description:\n\n"${PROMPT}"` },
      ],
      temperature: 0,
      tools: [{ type: "function", function: { name: "emit", description: "Emit the structured result.", parameters: transformSchema } }],
      tool_choice: { type: "function", function: { name: "emit" } },
    },
    settings.timeouts.queryTransformMs
  );
  const tArgs = JSON.parse(tcRes.json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
  const tUsage = tcRes.json?.usage ?? {};
  totals.ms += tcRes.ms;
  totals.promptTokens += tUsage.prompt_tokens ?? 0;
  totals.completionTokens += tUsage.completion_tokens ?? 0;

  const transformed: TransformedQuery = {
    transformedQuery: tArgs.transformedQuery ?? PROMPT,
    suggestedApis: tArgs.suggestedApis ?? [],
    domain: tArgs.domain ?? "general",
    tags: tArgs.tags ?? [],
    estimatedComplexity: tArgs.estimatedComplexity ?? "intermediate",
    ok: !!tArgs.transformedQuery,
  };

  W(`**Output (structured):**`);
  fence("json", JSON.stringify(tArgs, null, 2));
  W(`**Latency:** ${tcRes.ms} ms   |   **Tokens:** prompt=${tUsage.prompt_tokens ?? "?"}, completion=${tUsage.completion_tokens ?? "?"}, total=${tUsage.total_tokens ?? "?"}`);
  W();
  W(`---`);

  // ─── STEP 2: Embedding ─────────────────────────────────────────────────────
  const embedText = transformed.ok
    ? `${transformed.transformedQuery}${transformed.suggestedApis.length ? `\nRelevant Manim APIs: ${transformed.suggestedApis.join(", ")}` : ""}`
    : PROMPT;
  W(`## Step 2 — Embedding  (\`providers/embedder.ts\`, model: ${config.EMBEDDER_MODEL}, ${config.EMBEDDING_DIM}-dim)`);
  W();
  W(`**Text actually embedded** (transformed query + suggested APIs):`);
  fence("text", embedText);
  const eStart = Date.now();
  const eRes = await fetch(`${config.OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.EMBEDDER_MODEL, input: [embedText] }),
  });
  const eJson = await eRes.json();
  const eMs = Date.now() - eStart;
  const vec = l2(eJson.embeddings[0]);
  totals.ms += eMs;
  const embTokens = eJson.prompt_eval_count ?? 0;
  totals.promptTokens += embTokens;
  W(`**Output:** ${vec.length}-dim unit vector. First 8 values:`);
  fence("text", "[" + vec.slice(0, 8).map((x) => x.toFixed(5)).join(", ") + ", … ]  (L2 norm = " + Math.sqrt(vec.reduce((s, x) => s + x * x, 0)).toFixed(4) + ")");
  W(`**Latency:** ${eMs} ms   |   **Tokens (input):** ${embTokens}   |   no completion tokens (embeddings)`);
  W();
  W(`---`);

  // ─── STEP 3: Dense vector search ───────────────────────────────────────────
  W(`## Step 3 — Dense vector search  (Atlas \`$vectorSearch\`, cosine)`);
  W();
  W(`Search params: numCandidates=${settings.retrieval.denseNumCandidates}, limit (denseTopK)=${settings.retrieval.denseTopK}.`);
  W();
  const sStart = Date.now();
  const dense = await store.vectorSearch(vec, settings.retrieval.denseTopK, settings.retrieval.denseNumCandidates);
  const sMs = Date.now() - sStart;
  totals.ms += sMs;
  W(`**Output:** ${dense.length} candidates. Top 15 by cosine similarity:`);
  W();
  W(`| # | similarity | docType | title |`);
  W(`|---|-----------|---------|-------|`);
  dense.slice(0, 15).forEach((c, i) =>
    W(`| ${i} | ${c.similarity.toFixed(4)} | ${c.doc.docType} | ${c.doc.title.replace(/\|/g, "\\|").slice(0, 70)} |`)
  );
  W();
  W(`**Latency:** ${sMs} ms   |   tokens: n/a (vector DB)`);
  W();
  W(`---`);

  // ─── STEP 4: Rerank ────────────────────────────────────────────────────────
  W(`## Step 4 — Rerank  (\`core/rerank.ts\`, LLM-as-reranker, model: ${settings.reranker.model})`);
  W();
  const pool = dense.slice(0, settings.retrieval.rerankCandidates);
  const docText = (sd: ScoredDoc) => {
    const parts = [sd.doc.title, sd.doc.content || sd.doc.embedText];
    if (sd.doc.apisUsed.length) parts.push(`APIs: ${sd.doc.apisUsed.slice(0, 12).join(", ")}`);
    return parts.join(" — ").replace(/\s+/g, " ").slice(0, settings.retrieval.rerankDocChars);
  };
  const numbered = pool.map((sd, i) => `[${i}] ${docText(sd)}`).join("\n");
  const rerankQuery = transformed.ok ? transformed.transformedQuery : PROMPT;
  const rerankPrompt =
    `You are a search-relevance ranker for Manim animation knowledge. ` +
    `Score how well each DOCUMENT helps answer the QUERY, from 0.0 (irrelevant) to 1.0 (highly relevant).\n\n` +
    `QUERY:\n${rerankQuery}\n\nDOCUMENTS:\n${numbered}\n\n` +
    `Respond with ONLY a compact JSON array, one object per document: [{"index": <number>, "score": <0..1>}]. Include every index exactly once. No prose, no markdown.`;
  W(`**Input to reranker** (${pool.length} candidates, each truncated to ${settings.retrieval.rerankDocChars} chars):`);
  fence("text", numbered);
  const rRes = await postChat(settings.reranker, { messages: [{ role: "user", content: rerankPrompt }], temperature: 0 }, settings.timeouts.rerankMs);
  const rRaw = rRes.json?.choices?.[0]?.message?.content ?? "";
  const rUsage = rRes.json?.usage ?? {};
  totals.ms += rRes.ms;
  totals.promptTokens += rUsage.prompt_tokens ?? 0;
  totals.completionTokens += rUsage.completion_tokens ?? 0;
  W(`**Raw reranker response:**`);
  fence("text", String(rRaw).trim());
  const scoresArr: Array<{ index: number; score: number }> = JSON.parse(String(rRaw).match(/\[[\s\S]*\]/)![0]);
  const scored = scoresArr
    .filter((r) => r.index >= 0 && r.index < pool.length && typeof r.score === "number")
    .map((r) => ({ ...pool[r.index]!, rerankScore: r.score }))
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
  W(`**Reordering (dense rank → rerank score):**`);
  W();
  W(`| rerank # | score | docType | title |`);
  W(`|----------|-------|---------|-------|`);
  scored.slice(0, 10).forEach((c, i) =>
    W(`| ${i} | ${(c.rerankScore ?? 0).toFixed(2)} | ${c.doc.docType} | ${c.doc.title.replace(/\|/g, "\\|").slice(0, 70)} |`)
  );
  W();
  W(`**Latency:** ${rRes.ms} ms   |   **Tokens:** prompt=${rUsage.prompt_tokens ?? "?"}, completion=${rUsage.completion_tokens ?? "?"}, total=${rUsage.total_tokens ?? "?"}`);
  W();
  W(`---`);

  // ─── STEP 5: Assembly ──────────────────────────────────────────────────────
  W(`## Step 5 — Context assembly  (\`core/assemble.ts\`)`);
  W();
  const aStart = Date.now();
  const { structuredContext, groundedPrompt } = assemble(PROMPT, transformed, scored, 5);
  const aMs = Date.now() - aStart;
  totals.ms += aMs;
  W(`Buckets the reranked hits by docType and derives style + pitfalls.`);
  W();
  W(`- **apiExamples:** ${structuredContext.apiExamples.length}`);
  W(`- **similarScripts:** ${structuredContext.similarScripts.length}`);
  W(`- **styleRecommendations:** ${structuredContext.styleRecommendations.length}`);
  W(`- **pitfalls:** ${structuredContext.pitfalls.length}`);
  W();
  W(`**apiExamples:**`);
  fence("json", JSON.stringify(structuredContext.apiExamples.map((a) => ({ symbol: a.symbol, category: a.category, signature: a.signature, score: a.score, snippetChars: a.snippet.length })), null, 2));
  W(`**similarScripts:**`);
  fence("json", JSON.stringify(structuredContext.similarScripts.map((s) => ({ title: s.title, apisUsed: s.apisUsed, complexity: s.complexity, score: s.score, codeChars: s.code.length })), null, 2));
  W(`**styleRecommendations:**`);
  fence("json", JSON.stringify(structuredContext.styleRecommendations, null, 2));
  W(`**pitfalls:**`);
  fence("json", JSON.stringify(structuredContext.pitfalls, null, 2));
  W(`**Latency:** ${aMs} ms   |   tokens: n/a (local assembly)`);
  W();
  W(`---`);

  // ─── FINAL OUTPUT ──────────────────────────────────────────────────────────
  W(`## Final output`);
  W();
  W(`### groundedPrompt (the headline output — fed to the code-gen model)`);
  fence("text", groundedPrompt);
  W();
  W(`### Full similarScripts code (what the code-gen model studies)`);
  for (const s of structuredContext.similarScripts) {
    W(`#### ${s.title}  (score ${s.score})`);
    fence("python", s.code);
  }
  W();
  W(`---`);

  // ─── TOTALS ────────────────────────────────────────────────────────────────
  W(`## Per-step time & tokens summary`);
  W();
  W(`| Step | Latency (ms) | Prompt tokens | Completion tokens | Model |`);
  W(`|------|--------------|---------------|-------------------|-------|`);
  W(`| 1. Query transform | ${tcRes.ms} | ${tUsage.prompt_tokens ?? "-"} | ${tUsage.completion_tokens ?? "-"} | ${settings.llm.model} |`);
  W(`| 2. Embedding | ${eMs} | ${embTokens} | - | ${config.EMBEDDER_MODEL} |`);
  W(`| 3. Vector search | ${sMs} | - | - | Atlas |`);
  W(`| 4. Rerank | ${rRes.ms} | ${rUsage.prompt_tokens ?? "-"} | ${rUsage.completion_tokens ?? "-"} | ${settings.reranker.model} |`);
  W(`| 5. Assembly | ${aMs} | - | - | local |`);
  W(`| **TOTAL** | **${totals.ms}** | **${totals.promptTokens}** | **${totals.completionTokens}** | — |`);
  W();
  W(`**LLM calls:** 2 (query transform + rerank).  **Total tokens:** ${totals.promptTokens + totals.completionTokens} ` +
    `(${totals.promptTokens} prompt + ${totals.completionTokens} completion).`);
  W();
  W(`> Note: this trace forces query-transform + rerank ON to expose every step, so total latency ` +
    `(~${(totals.ms / 1000).toFixed(1)}s) is higher than the production default (query-transform OFF, ~2.3s p95).`);

  writeFileSync(OUT, md.join("\n"));
  console.log(`Wrote trace → ${OUT}`);
  console.log(`Totals: ${totals.ms}ms, ${totals.promptTokens + totals.completionTokens} tokens`);
  await disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await disconnect(); } catch {}
  process.exit(1);
});
