# Manim RAG service

This service retrieves Manim API references and scene examples for an animation
request. It returns a grounded prompt, structured examples and retrieval timing.
It does not generate or render videos.

The pipeline optionally rewrites the query with an LLM, embeds it, searches MongoDB
vectors, optionally adds text search with reciprocal rank fusion, optionally
reranks with an LLM, selects relevant examples with API coverage, and assembles
context with curated pitfalls. Query transform and rerank default to off. Their
failures fall back to the raw query and retrieval order. Embedding or database
failures return a pipeline error; the calling API may continue without RAG.

## Local use

Use Node.js 20 or later and Docker. From `services/rag`, install and check:

```sh
npm ci && npx tsc --noEmit && npm test
```

Start a MongoDB instance that includes Search. Plain `mongo` images lack the
required search APIs. This command uses an isolated local port:

```sh
docker run -d --name oss-rag-atlas -p 127.0.0.1:27187:27017 mongodb/mongodb-atlas-local:8.0
```

Set `MONGODB_URL=mongodb://localhost:27187/?directConnection=true` and a
`RAG_API_KEY` with at least 16 characters in your environment or a gitignored
`.env`. No other key is needed: the default embedder is local and runs on CPU.
The model weights (about 34 MB) download into `.models/` on first use.
`.env.example` lists common settings. Then run:

```sh
npm run seed
npm start
```

The seed reads only `data/`. It skips existing document IDs. `npm run seed:reset`
clears the corpus and search indexes before rebuilding. Use it after changing
embedding provider, model or dimensions. A model change requires re-embedding even
when dimensions stay the same. Both seed and startup create indexes and wait for
`queryable: true`; incompatible index dimensions fail with a reset instruction.
Atlas and the local image use the same MongoDB driver and search pipeline.

Docker: `docker build -t rag .` uses a Debian slim base (the ONNX runtime has no
Alpine build), downloads the embedding weights during the build and sets
`EMBEDDER_OFFLINE=true`. The image is about 690 MB, of which the model is 34 MB.
Run it with `MONGODB_URL` and `RAG_API_KEY`; no embedding key is needed.

`notebooks/` records how the API corpus was built. Its generated output is not a
runtime dependency. `seed_corpus/` contains separate plugin authoring and ingestion
tools. See [NOTICE.md](NOTICE.md) for corpus attribution.

## HTTP API

All write and corpus routes require `x-api-key: <RAG_API_KEY>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Probe database, embedder and enabled optional LLM stages |
| GET | `/capabilities` | Show models, settings and supported request overrides |
| POST | `/enhance` | Body `{ "prompt": "bubble sort on 6 bars" }`; returns `groundedPrompt`, `structuredContext`, `retrievalTrace`, `execution`, `trace` |
| POST | `/corpus/add` | Embed and upsert a `documents` array |
| GET | `/corpus/stats` | Counts by document type, category and domain |
| DELETE | `/corpus/:id` | Remove a document |

`/enhance` accepts `options.topK` and `overrides` for stages, retrieval, timeouts,
LLM and reranker targets. BYO LLM keys use `x-llm-key` and `x-reranker-key`.
The existing `providerConfig.queryTransform` and `providerConfig.embedder` fields
remain supported. Embedding overrides must match the seeded model's vector space
and dimensions. Optional stages can be enabled per request without changing env.

## Providers

LLM and reranker use OpenAI-compatible chat endpoints. `opencode` remains an alias
for `opencodego`. The `thinking` parameter is added by default only for OpenCode Go.
Explicit per-request `extraBody` or `params` are passed through.

| Provider | Default chat base URL | Default model |
| --- | --- | --- |
| openai | `https://api.openai.com/v1` | `gpt-4o-mini` |
| gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash` |
| openrouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| ollama | `http://localhost:11434/v1` | `llama3.2` |
| opencodego | `https://opencode.ai/zen/go/v1` | `glm-5.1` |

Embedders: `local` (the default) runs `Xenova/bge-small-en-v1.5` (384 dimensions,
8-bit weights) inside the service with `@huggingface/transformers`. It needs no key
and no network once the weights are cached. The Docker image bakes the weights in
and sets `EMBEDDER_OFFLINE=true`. `openai` defaults to `text-embedding-3-small` (1536 dimensions),
`gemini` to `gemini-embedding-001` (3072), and `ollama` to `nomic-embed-text`
(768). Known alternatives include `text-embedding-3-large` (3072),
`text-embedding-ada-002` (1536), `bge-m3` (1024), and `all-minilm` (384).
Unknown models require `EMBEDDING_DIM`. Wrong output dimensions are rejected.
Ollama models must already be downloaded. Hosted providers need a key.

Gemini free tier caps embedding at 1000 requests per day, and each text in a batch
counts as one request. The 1,333-document corpus cannot be seeded in one day on
that tier, and query embedding fails with 429 once the cap is hit. Use `local` or a
billed key.

Endpoint references: [Gemini](https://ai.google.dev/gemini-api/docs/openai),
[OpenRouter](https://openrouter.ai/docs/api/reference/overview),
[MongoDB local Search](https://www.mongodb.com/docs/search/self-managed/current/installation/quick-start/).

## Environment

Only `RAG_API_KEY` is required to start HTTP. A hosted embedder (`openai`, `gemini`) requires
`EMBEDDER_API_KEY`, `EMBEDDER_API_KEYS`, or the shared `LLM_API_KEY`. The default
`local` embedder needs none.
Other settings are optional. Chat keys are required only for enabled hosted stages.

| Variable | Required | Default |
| --- | --- | --- |
| `MONGODB_URL` | no | `mongodb://localhost:27017/?directConnection=true` |
| `MONGODB_DB_NAME` | no | `manimrag` |
| `VECTOR_STORE` | no | `mongodb_atlas` (also identifies atlas-local) |
| `COLLECTION_NAME` | no | `manimrag_corpus` |
| `VECTOR_INDEX_NAME` | no | `manimrag_vector_index` |
| `TEXT_INDEX_NAME` | no | `manimrag_text_index` |
| `RAG_API_KEY` | yes, HTTP | no usable default; minimum 16 characters |
| `LLM_API_KEY` | hosted LLM stages, or shared hosted embeddings | empty |
| `LLM_PROVIDER` | no | `openai` |
| `LLM_MODEL` | no | provider default above |
| `LLM_BASE_URL` | no | provider default above |
| `RERANKER_PROVIDER` | no | `LLM_PROVIDER` |
| `RERANKER_MODEL` | no | LLM model if same provider, else provider default |
| `RERANKER_API_KEY` | no | `LLM_API_KEY` |
| `RERANKER_BASE_URL` | no | LLM base URL if same provider, else provider default |
| `RERANKER_TOP_N` | no | `5` |
| `OPENCODE_GO_BASE_URL` | no | `https://opencode.ai/zen/go/v1` |
| `OPENCODE_DISABLE_THINKING` | no | `true`; OpenCode Go only |
| `ALLOWED_LLM_BASE_URLS` | no | empty; comma-separated override URL prefixes |
| `EMBEDDER_PROVIDER` | no | `local` (also `openai`, `gemini`, `ollama`) |
| `MODELS_DIR` | no | `.models`; Docker image uses `/app/models` |
| `EMBEDDER_OFFLINE` | no | `false`; `true` in Docker, blocks weight downloads |
| `LOCAL_EMBED_DTYPE` | no | `q8` (also `fp32`, `fp16`, `q4`) |
| `EMBEDDER_MODEL` | no | provider default above |
| `EMBEDDER_API_KEY` | `openai` and `gemini` embeddings | `LLM_API_KEY` fallback |
| `EMBEDDER_API_KEYS` | no | empty; comma-separated rotation, takes precedence |
| `EMBEDDER_BASE_URL` | no | provider endpoint below |
| `EMBEDDING_DIM` | unknown embedding models | inferred from known model above (`local`: 384) |
| `EMBED_BATCH_SIZE` | no | `100` |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1`; embeddings |
| `GEMINI_BASE_URL` | no | `https://generativelanguage.googleapis.com/v1beta`; native embeddings |
| `OLLAMA_BASE_URL` | no | `http://localhost:11434`; native embeddings |
| `STAGE_QUERY_TRANSFORM` | no | `false` |
| `STAGE_RERANK` | no | `false` |
| `STAGE_SPARSE` | no | `false` |
| `STAGE_PITFALLS` | no | `true` |
| `DEFAULT_TOP_K` | no | `5` |
| `DENSE_TOP_K` | no | `40` |
| `DENSE_NUM_CANDIDATES` | no | `200` |
| `SPARSE_TOP_K` | no | `40` |
| `RERANK_CANDIDATES` | no | `20` |
| `RERANK_DOC_CHARS` | no | `600` |
| `RRF_K` | no | `60` |
| `QUERY_TRANSFORM_TIMEOUT_MS` | no | `2200` |
| `EMBED_TIMEOUT_MS` | no | `8000` |
| `EMBED_BATCH_TIMEOUT_MS` | no | `30000` |
| `VECTOR_SEARCH_TIMEOUT_MS` | no | `5000` |
| `RERANK_TIMEOUT_MS` | no | `4000` |
| `RETRY_MAX` | no | `3` |
| `RETRY_BASE_MS` | no | `300` |
| `LOG_LEVEL` | no | `info` |
| `PORT` | no | `7000` |
| `HOST` | no | `0.0.0.0` |
| `RATE_LIMIT_MAX` | no | `120` per minute |
| `OTEL_SDK_DISABLED` | no | `false`; set `true` without a collector |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | no | `stitcher-rag` |
| `OTEL_DIAG_DEBUG` | no | `false` |
