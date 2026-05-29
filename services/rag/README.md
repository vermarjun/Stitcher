# ManimRAG

A low-latency, resilient **retrieval service** with one job: given a natural-language
animation request, return the most relevant Manim v0.19 knowledge so a downstream
code-generation model can write correct Manim Python **without hallucinating APIs**.

It does **not** generate code, render videos, or run Manim — it retrieves and assembles
grounding context.

```
POST /enhance  { "prompt": "animate bubble sort with bars swapping heights" }
        │
        ▼
 query transform (glm-5.1, optional)  ──fallback──▶ raw query
        │
        ▼  embed (bge-m3 / gemini-embedding-001)
 dense vector search (Atlas)  (+ optional BM25 → RRF)
        │
        ▼  rerank (deepseek-v4-flash LLM, optional, capped)
 context assembly  →  groundedPrompt + structuredContext
```

Every stage is **opt-in via env**, **measured** (per-stage latency in the response), and
**resilient** (retry/backoff + graceful degradation — a failing LLM never fails the request).

---

## Architecture

Single MongoDB Atlas collection (`manimrag_corpus`) of `CorpusDoc`s discriminated by
`docType`:

- **`api`** — Manim API reference (classes, methods, modules) from `chunks_all.json`.
- **`script`** — full runnable scenes (curated seed + scraped examples).

This split lets `/enhance` return API references and complete example scenes as separate
buckets, and the single-collection design keeps retrieval to **one round-trip**.

| Stage | Module | Toggle | Notes |
|-------|--------|--------|-------|
| Query transform | `core/query-transform.ts` | `STAGE_QUERY_TRANSFORM` | glm-5.1 structured output; timeout → raw-query fallback |
| Embed | `providers/embedder.ts` | always | Ollama `bge-m3` (local) or Gemini `gemini-embedding-001` |
| Dense retrieval | `core/retrieve.ts` | always | Atlas `$vectorSearch` |
| Sparse / BM25 | `core/retrieve.ts` | `STAGE_SPARSE` | Atlas `$search` + RRF fusion (needs text index) |
| Rerank | `core/rerank.ts` | `STAGE_RERANK` | deepseek-v4-flash LLM, capped at `RERANK_CANDIDATES`, fallback to vector order |
| Assembly | `core/assemble.ts` | `STAGE_PITFALLS` for pitfalls | buckets + curated style/pitfalls + groundedPrompt |

---

## Prerequisites

- **Node ≥ 20** (tested on 26).
- **MongoDB Atlas** cluster with Vector Search (free M0 works).
- **Embedder** — either:
  - **Ollama** (default in `.env`): `ollama serve` with `ollama pull bge-m3` → 1024-dim, local, no rate limit.
  - **Gemini**: a `gemini-embedding-001` API key → 3072-dim (free tier is rate-limited to 100 embed-requests/min; seeding self-paces around it).
- **OpenCode-Go** API key for the query-transform LLM (glm-5.1) and reranker (deepseek-v4-flash).

---

## Setup

```bash
cd pipeline
npm install
cp .env.example .env     # then fill in MONGODB_URL + keys (or use the provided .env)
```

Key `.env` choices (everything is opt-in; see `.env.example` for the full list):

```bash
EMBEDDER_PROVIDER=ollama          # or gemini
EMBEDDER_MODEL=bge-m3:latest      # gemini-embedding-001 for gemini
EMBEDDING_DIM=1024                # 3072 for gemini — MUST match the index
LLM_MODEL=glm-5.1                 # must support tool_choice
RERANKER_MODEL=deepseek-v4-flash  # any model (plain completion)
STAGE_QUERY_TRANSFORM=true
STAGE_SPARSE=false
STAGE_RERANK=true
RAG_API_KEY=<min 16 chars>
```

> **Dimension rule:** `EMBEDDING_DIM` must equal the vector index's `numDimensions`.
> Changing the embedder/dim after seeding requires `npm run seed:reset` (which drops and
> rebuilds the index — Atlas silently keeps the old dims otherwise).

---

## Run commands

### 1. Expand the dataset (scrape full scene examples)

```bash
npm run scrape                # mines chunk examples + scrapes ManimCommunity GitHub & docs
npm run scrape -- --enrich    # also LLM-generate NL descriptions (uses the reranker model)
npm run scrape -- --limit 100 # cap output
```

Writes `data/expanded_examples.json` (de-duped, parse-validated via `python3`).

### 2. Seed the vector DB

```bash
npm run seed          # idempotent — embeds + upserts, skips ids already present
npm run seed:reset    # DROP the search index(es) + all docs, then re-seed from scratch
```

`seed:reset` is required whenever the embedder/dimension changes. It drops the index,
re-embeds the full corpus (API chunks + seed scripts + scraped scripts), recreates the
vector index (+ BM25 text index if `STAGE_SPARSE=true`), and **waits until the index is
READY** before exiting.

### 3. Start the service

```bash
npm start             # tsx src/server.ts → http://localhost:7000
npm run dev           # watch mode
PORT=7070 npm start   # macOS: port 7000 is used by AirPlay Receiver — override it
                      # (or disable System Settings ▸ General ▸ AirDrop & Handoff ▸ AirPlay Receiver)
```

### Admin / introspection

```bash
npm run health        # component health from the CLI
npm run stats         # corpus counts by docType / category / domain
npm run typecheck
npm test
```

---

## HTTP API

All protected routes require the `x-api-key: <RAG_API_KEY>` header.

### `POST /enhance` — the headline route

```bash
curl -s localhost:7000/enhance \
  -H "x-api-key: $RAG_API_KEY" -H 'content-type: application/json' \
  -d '{"prompt":"animate bubble sort with bars swapping heights","options":{"topK":5}}'
```

Response:

```jsonc
{
  "groundedPrompt": "…assembled prompt: task + API refs + similar full scenes + style + pitfalls…",
  "structuredContext": {
    "apiExamples":          [ { "symbol", "category", "signature", "docstring", "snippet", "source", "score" } ],
    "similarScripts":       [ { "id", "title", "description", "apisUsed", "complexity", "code", "score" } ],
    "styleRecommendations": [ "…" ],
    "pitfalls":             [ "…" ]
  },
  "retrievalTrace": {
    "denseCandidates", "sparseCandidates", "mergedCandidates", "afterRerank",
    "embedModel", "rerankModel", "store", "queryTransformed", "stages"
  },
  "execution": {
    "totalMs", "queryTransformMs", "embeddingMs", "vectorSearchMs",
    "sparseSearchMs", "rerankMs", "assembleMs", "llmCalls"
  }
}
```

`groundedPrompt` is the headline output — feed it directly to your code-gen model.

#### Per-request overrides + BYOK

Every stage/model/param **except the embedder** (index-locked → set in `.env` + re-seed) can be
overridden per call via an optional `overrides` object. Absent fields fall back to env defaults.
API keys are supplied via **headers** (`x-llm-key`, `x-reranker-key`) — never the body — so they
aren't logged with payloads. `GET /capabilities` lists the full overridable surface.

```bash
curl -s localhost:7000/enhance \
  -H "x-api-key: $RAG_API_KEY" \
  -H "x-reranker-key: $CALLER_OWN_KEY" \           # BYOK (optional)
  -H 'content-type: application/json' \
  -d '{
    "prompt": "animate bubble sort with bars",
    "options": { "topK": 5 },
    "overrides": {
      "stages":    { "queryTransform": false, "sparse": false, "rerank": true },
      "retrieval": { "denseTopK": 40, "rerankCandidates": 8 },
      "timeouts":  { "rerankMs": 3500 },
      "reranker":  { "model": "mimo-v2.5",
                     "baseUrl": "https://opencode.ai/zen/go/v1",
                     "extraBody": { "thinking": { "type": "disabled" } } },
      "llm":       { "model": "kimi-k2.5", "extraBody": { "thinking": { "type": "disabled" } } }
    }
  }'
```

- **`extraBody`** is merged verbatim into the OpenAI-compatible request body, so any provider's
  reasoning knob works (`{"thinking":{"type":"disabled"}}` for OpenCode-Go,
  `{"reasoning_effort":"low"}` for OpenAI, etc.) without code changes. Default comes from
  `OPENCODE_DISABLE_THINKING`.
- **`baseUrl`** overrides are validated (http/https) and, if `ALLOWED_LLM_BASE_URLS` is set,
  must match an allow-listed prefix (SSRF guard). Out-of-bounds / unknown override fields → `400`.
- `retrievalTrace.rerankModel` and `.stages` report what was *actually* used for that request.

### Other routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | no | Per-component status (vectorStore, embedder, reranker, llm). 200 ok/degraded, 503 error |
| GET | `/capabilities` | no | Enabled stages, models, dims, retrieval tuning, perf targets |
| POST | `/corpus/add` | yes | Add documents (embeds + upserts) |
| GET | `/corpus/stats` | yes | Counts by docType / category / domain |
| DELETE | `/corpus/:id` | yes | Remove a document |

---

## Performance

Targets (reported per-request in `execution`): end-to-end p95 ≤ 3000 ms (hard ceiling
5000 ms), vector search < 150 ms, query embedding < 800 ms, rerank < 1500 ms. The
query-transform and rerank LLM calls are the swing factors — both are optional, bounded by
timeouts, and degrade gracefully, so a slow/failed LLM keeps the request under the ceiling
(`llmCalls` reflects how many actually ran).

## Resilience

- Per-call timeouts + exponential backoff with jitter (`util/retry.ts`).
- Query transform: timeout → embed the raw query instead.
- Reranker: failure → keep vector/RRF ordering.
- Sparse: missing text index → dense-only.
- Embedder: 429-aware backoff honoring the server's per-minute retry window; multi-key
  rotation via `EMBEDDER_API_KEYS`.
