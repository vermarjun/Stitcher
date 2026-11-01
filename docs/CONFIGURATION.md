# Configuration

Every environment variable Stitcher reads, grouped by where it is read.

You normally edit one file: the root `.env`. `./scripts/setup.sh` creates it from `.env.example`.
`compose.yaml` then hands each service only the variables that service needs. Part 1 lists the
root variables and where each one goes. Parts 2 to 6 list what each service reads, with its
default, so you can see what a value does when you run a service on its own.

In the tables, "Required" means the service refuses to start (or the feature cannot work)
without the value. An empty value counts as unset everywhere.

## 1. Root `.env` (read by Docker Compose)

### Required

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `LLM_PROVIDER` | `openai` in compose, `gemini` in `.env.example` | Default LLM provider: `openai`, `anthropic`, `gemini`, `openrouter`, `groq`, `ollama` or `opencodego`. | api, agent (`DEFAULT_PROVIDER`), rag |
| `LLM_API_KEY` | empty | API key for the provider. Not needed for `ollama`. | api, rag |
| `JWT_SECRET` | none, required | Signs login tokens. At least 32 characters. | api |
| `REDIS_PASSWORD` | none, required | Redis password. | redis, api, agent |
| `AGENT_API_KEY` | none, required | Shared secret between api and agent. | api, agent |
| `RAG_API_KEY` | none, required | Shared secret between api and rag. At least 16 characters. | api, rag, rag-seed |
| `RENDER_API_KEY` | none, required | Shared secret between api and render. At least 16 characters. | api, render |

`setup.sh` generates the five secrets with `openssl rand -hex 32`.
Compose stops with a clear message when one of them is missing.

### LLM

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `LLM_MODEL` | provider default | Model for every role. Defaults: openai `gpt-4.1-mini`, anthropic `claude-sonnet-5-5`, gemini `gemini-2.5-flash`, groq `llama-3.3-70b-versatile`, ollama `llama3.1`, opencodego `glm-5.1`. openrouter has none. | api, agent, rag |
| `LLM_BASE_URL` | provider default | Endpoint for an OpenAI-compatible server. `setup.sh` sets `http://host.docker.internal:11434/v1` for ollama. | api, rag |
| `CODER_PROVIDER`, `CODER_MODEL`, `CODER_API_KEY`, `CODER_BASE_URL` | `LLM_*` | Override the model that writes scene code. | api |
| `DEBUGGER_PROVIDER`, `DEBUGGER_MODEL`, `DEBUGGER_API_KEY`, `DEBUGGER_BASE_URL` | `LLM_*` | Override the model that fixes failed renders. | api |
| `QUERY_TRANSFORM_PROVIDER`, `QUERY_TRANSFORM_MODEL`, `QUERY_TRANSFORM_API_KEY`, `QUERY_TRANSFORM_BASE_URL` | `LLM_*` | Override the model that rewrites the prompt for retrieval. | api |
| `RAG_LLM_PROVIDER`, `RAG_LLM_API_KEY`, `RAG_LLM_MODEL`, `RAG_LLM_BASE_URL` | `LLM_*` | Fallback LLM inside the RAG service. The RAG service accepts only openai, gemini, openrouter, ollama and opencodego. For anthropic and groq, `setup.sh` fills these with an OpenAI-compatible endpoint. | rag |

A role that uses a different provider than `LLM_PROVIDER` does not inherit the default key or model.
The API sends the provider, model, key and base URL to the agent and RAG services with each job.

### Where the app is served

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `PUBLIC_URL` | `http://localhost:8080` | Address you type in the browser. Used for CORS, email links and media links. Change it when you serve Stitcher from another host or port. | api |
| `WEB_PORT` | `8080` | Host port that maps to the web container. | web |

### Embeddings

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `EMBEDDER_PROVIDER` | `local` | `local` (CPU model inside the RAG image, no key), `openai`, `gemini` or `ollama`. Anthropic has no embeddings. | rag, rag-seed |
| `EMBEDDER_MODEL` | provider default | Embedding model. | rag, rag-seed |
| `EMBEDDER_API_KEY` | `LLM_API_KEY` | Key for `openai` or `gemini` embeddings. | rag, rag-seed |
| `EMBEDDER_BASE_URL` | provider default | Custom embeddings endpoint. | rag, rag-seed |
| `EMBEDDING_DIM` | known models | Vector size. Needed only for an unknown model. | rag, rag-seed |
| `EMBEDDER_OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama address for embeddings. | rag, rag-seed (`OLLAMA_BASE_URL`) |
| `QUERY_TRANSFORM_TIMEOUT_MS` | `6000` | Time limit for the prompt rewrite. The service default of 2200 is too short for hosted models. | rag |

The index is built for one embedder. After you change `EMBEDDER_PROVIDER`, `EMBEDDER_MODEL` or
`EMBEDDING_DIM`, rebuild it:

```bash
docker compose run --rm rag-seed node dist/seed.cjs --reset
```

The API does not send `EMBEDDER_*` to the RAG service from compose. Retrieval always embeds queries
with the same embedder that built the index.

### Voiceover

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `TTS_PROVIDER` | `gtts` | `gtts` (no key, needs internet) or `azure`. Any other value falls back to `gtts`. | api |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | empty | Azure Speech credentials for `azure`. | api |
| `DEFAULT_VOICEOVER_VOICE` | `en-US-AvaNeural` for azure | Default voice. | api |
| `DEFAULT_VOICEOVER_LANG` | `en` | Default language code. | api |
| `TTS_MAX_CONCURRENCY` | `3` | Parallel voice requests per job. | api |

### Storage

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `STORAGE` | `local` | `local` keeps files in the `media` volume and serves them at `/api/media`. `cloudinary` uploads to Cloudinary. | api |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | empty | Required when `STORAGE=cloudinary`. | api |
| `MAX_UPLOAD_MB` | `500` | Largest upload accepted. The nginx limit is 600 MB. | api |

### Email

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `EMAIL_PROVIDER` | `console` | `console` prints messages, including signup codes, to the API log. `smtp` and `gmail` send real mail. | api |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | empty | SMTP settings. For `gmail`, use an app password as `SMTP_PASS`. | api |

### Google sign-in

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | empty | Enables the Google button. Also baked into the web image at build time. | api, web (build) |
| `GOOGLE_CLIENT_SECRET` | empty | Matching secret. | api |

### Render service and builds

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `RENDER_MAX_CONCURRENT` | `2` | Videos rendered at once. Each can use about 2 GB of RAM. | render (`MAX_CONCURRENT_RENDERS`) |
| `RENDER_SLIM` | `0` | `1` builds the render image without texlive-science and vedo. | render (build) |
| `APT_MIRROR` | empty | Debian mirror for the render image build, for example `http://cdn-aws.deb.debian.org`. | render (build) |
| `PIP_INDEX_URL` | empty | Python package index for the render image build. | render (build) |
| `APK_MIRROR` | empty | Alpine mirror root for the api image build, for example `https://mirrors.edge.kernel.org/alpine`. Set it, and `APT_MIRROR`, on slow networks. | api (build) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. | api, agent, rag, rag-seed |

### Observability (profile `obs`)

| Variable | Default | What it does | Goes to |
|---|---|---|---|
| `OTEL_SDK_DISABLED` | `true` | Set `false` to send traces and metrics. | agent, rag, render |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | empty for api, `http://otel-collector:4318` for others | Collector address. The API sends nothing while this is empty. | api, agent, rag, render |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | empty | Langfuse keys for the agent. Both unset turns the callbacks off. | agent |
| `LANGFUSE_HOST` | `http://langfuse:3000` | Langfuse address for the agent. | agent |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password. `setup.sh` generates one. | grafana |
| `LANGFUSE_DB_PASSWORD` | `langfuse` | Postgres password for Langfuse. `setup.sh` generates one. | langfuse, langfuse-db |
| `LANGFUSE_NEXTAUTH_SECRET`, `LANGFUSE_SALT`, `LANGFUSE_ENCRYPTION_KEY` | placeholders | Langfuse secrets. The key is 64 hex characters. `setup.sh` generates them. | langfuse |
| `GRAFANA_PORT`, `PROMETHEUS_PORT`, `LANGFUSE_PORT` | `3001`, `9090`, `3002` | Host ports, bound to 127.0.0.1. | grafana, prometheus, langfuse |

### Developer override

`compose.dev.yaml` publishes MongoDB and Redis on 127.0.0.1 so a service running on your host can use them
(`docker compose -f compose.yaml -f compose.dev.yaml up -d mongo redis`).

| Variable | Default | What it does |
|---|---|---|
| `MONGO_PORT` | `27017` | Host port for MongoDB. |
| `REDIS_PORT` | `6379` | Host port for Redis. |

### Fixed by compose

These are set in `compose.yaml` and are not read from `.env`:

| Service | Variable | Value | Why |
|---|---|---|---|
| api | `MONGODB_URL` | `mongodb://mongo:27017/stitcher?directConnection=true` | Atlas Local runs as a one-node replica set. |
| api | `REDIS_HOST`, `REDIS_PORT` | `redis`, `6379` | Compose network name. |
| api | `RAG_SERVICE_URL`, `AGENT_SERVICE_URL`, `RENDER_SERVICE_URL` | `http://rag:7000`, `http://agent:4000`, `http://render:8000` | Compose network names. |
| api | `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `PUBLIC_API_URL` | `PUBLIC_URL` | The browser reaches the API through nginx on the same origin. |
| api | `STORAGE_DIR` | `/app/data/media` | The `media` volume mount. |
| api | `NODE_ENV`, `PORT`, `API_PREFIX` | `production`, `3000`, `/api` | |
| rag | `STAGE_QUERY_TRANSFORM` | `true` | Without it the coder never gets `requiredPlugins`, so plugin skills are never used. |
| rag | `MONGODB_URL` | `mongodb://mongo:27017/?directConnection=true` | |
| agent | `CHECKPOINT_REDIS_URL` | `redis://:<REDIS_PASSWORD>@redis:6379` | |
| render | `ENV`, `SANDBOX_ENABLED` | `production`, `true` | Production refuses to run without the sandbox. |
| render | `STORAGE_BACKEND`, `LOCAL_STORAGE_PATH` | `local`, `/tmp/renders` | The `render-files` volume. |
| render | `LOCAL_STORAGE_PUBLIC_URL_BASE` | `http://render:8000/files/` | The API downloads each video from here. |
| web | `VITE_BACKEND_URL` (build arg) | `/api` | Same origin as the page. |

## 2. API (`apps/api`)

Read by `src/config.ts` unless noted. See `apps/api/.env.example` for comments.

| Variable | Default | Required | What it does |
|---|---|---|---|
| `NODE_ENV` | `development` | no | `development`, `production` or `test`. Production logs JSON. |
| `PORT` | `3000` | no | HTTP port. |
| `API_PREFIX` | `/api` | no | URL prefix for every route. Empty means none. |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | no | Comma-separated browser origins allowed by CORS and Socket.IO. |
| `PUBLIC_APP_URL` | first `ALLOWED_ORIGINS` entry | no | Web app address, used in email links. |
| `PUBLIC_API_URL` | `http://localhost:PORT` | no | API address without the prefix, used for local media URLs. |
| `LOG_LEVEL` | `info` | no | `debug`, `info`, `warn` or `error`. |
| `MONGODB_URL` | none | yes | MongoDB connection string. |
| `JWT_SECRET` | none | yes | At least 32 characters. |
| `REDIS_HOST` | none | yes | Redis host. |
| `REDIS_PORT` | `6379` | no | Redis port. |
| `REDIS_PASSWORD` | empty | no | Redis password. |
| `RAG_SERVICE_URL`, `RAG_API_KEY` | none | yes | RAG service address and key. |
| `AGENT_SERVICE_URL`, `AGENT_API_KEY` | none | yes | Agent service address and key. |
| `RENDER_SERVICE_URL`, `RENDER_API_KEY` | none | yes | Render service address and key. |
| `EMAIL_PROVIDER` | `console` | no | `console`, `smtp` or `gmail`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | empty | with `smtp` | SMTP server. Port defaults to 587 for `smtp` and 465 for `gmail`. |
| `EMAIL_FROM` | built from `SMTP_USER` | no | From header. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | empty | no | Google sign-in. Unset answers 404 `google_auth_disabled`. |
| `STORAGE` | `local` | no | `local` or `cloudinary`. |
| `STORAGE_DIR` | `./data/media` | no | Folder for local storage, served at `${API_PREFIX}/media`. |
| `MAX_UPLOAD_MB` | `500` | no | Largest upload. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | empty | with `cloudinary` | Cloudinary account. |
| `LLM_PROVIDER` | `openai` | no | Default provider. |
| `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` | empty | no | Default model, key and endpoint. `ollama` defaults its endpoint to `http://localhost:11434/v1`. |
| `CODER_*`, `DEBUGGER_*`, `QUERY_TRANSFORM_*` | empty | no | Per-role `PROVIDER`, `MODEL`, `API_KEY`, `BASE_URL`. |
| `EMBEDDER_PROVIDER`, `EMBEDDER_MODEL`, `EMBEDDER_API_KEY`, `EMBEDDER_BASE_URL` | empty | no | Embedder override sent with each RAG request. Leave empty to use the RAG service's own embedder. Compose leaves them out. |
| `TTS_PROVIDER` | `gtts` | no | `gtts` or `azure`. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | empty | with `azure` | Azure Speech. Region falls back to `eastus`. |
| `DEFAULT_VOICEOVER_VOICE` | empty | no | Default voice. |
| `DEFAULT_VOICEOVER_LANG` | `en` | no | Default language code. |
| `TTS_MAX_CONCURRENCY` | `3` | no | Parallel TTS requests per job (read in `src/services/ttsClient.ts`). |
| `EXPORT_FFMPEG_PATH` | `ffmpeg` on PATH | no | ffmpeg binary for timeline export. |
| `EXPORT_FONT_PATH` | first common system font | no | Font file for text overlays in the export. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | empty | no | OTLP/HTTP collector base URL. Telemetry stays off while empty. |
| `OTEL_SERVICE_NAME` | `stitcher-api` | no | Service name in traces. |
| `OTEL_TRACES_SAMPLER` | `always_on` | no | Sampler name. |

`scripts/smoke.ts` also reads `SMOKE_API_BASE_URL`, `SMOKE_TIMEOUT_SEC` and `SMOKE_MOCK`.

## 3. Agent (`services/agent`)

Read by `src/config.ts` and `src/instrumentation.ts`. See `services/agent/.env.example`.

| Variable | Default | Required | What it does |
|---|---|---|---|
| `AGENT_API_KEY` | none | yes | Secret for `X-Api-Key` on job routes. |
| `HOST`, `PORT` | `0.0.0.0`, `4000` | no | Listen address. |
| `NODE_ENV` | `development` | no | Compose sets `production`. |
| `CHECKPOINT_REDIS_URL` | `redis://localhost:6379` | no | Redis for job snapshots. Without it `/health` is degraded. |
| `DEFAULT_PROVIDER` | `openai` | no | Provider used when a request names none. |
| `DEFAULT_MODEL_PLANNER`, `DEFAULT_MODEL_CODER`, `DEFAULT_MODEL_DEBUGGER` | provider default | no | Fallback models per role. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `OPENCODE_GO_API_KEY` | unset | for the chosen provider | Fallback keys. The API sends a key with each request, so compose does not set these. |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | no | Ollama endpoint. Compose defaults it to `host.docker.internal`. |
| `AWS_REGION` | `us-east-1` | no | Region for Bedrock, which uses the AWS credential chain. |
| `ENABLE_WEB_SEARCH` | `false` | no | Let the planner search the web. |
| `WEB_SEARCH_PROVIDER` | `tavily` | no | `tavily`, `serper` or `brave`. |
| `TAVILY_API_KEY`, `SERPER_API_KEY`, `BRAVE_API_KEY` | unset | for the chosen search | Search keys. |
| `WEB_SEARCH_MAX_CALLS_PER_JOB` | `3` | no | Search calls per job. |
| `MAX_PARALLEL_SCENES` | `6` | no | Scenes coded at once. |
| `DEFAULT_MAX_VALIDATION_RETRIES` | `3` | no | Validation retries. |
| `DEFAULT_TIMEOUT_SEC` | `300` | no | Job timeout. |
| `MAX_CODE_SIZE_BYTES` | `524288` | no | Largest generated file. |
| `PROMPT_VERSION_PLANNER`, `PROMPT_VERSION_CODER`, `PROMPT_VERSION_DEBUGGER`, `PROMPT_VERSION_REFINER` | `active` | no | Prompt version per role. |
| `LOG_LEVEL` | `info` | no | Log level. |
| `CAPTURE_LLM_IO` | `false` | no | Save prompts and replies. |
| `LLM_IO_SINK` | `local` | no | Where captures go. |
| `LLM_IO_LOCAL_PATH` | `./llm_captures` | no | Folder for local captures. |
| `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` | unset | no | Both unset turns Langfuse off. |
| `LANGFUSE_HOST` | `https://cloud.langfuse.com` | no | Langfuse address. |
| `LANGFUSE_BASEURL` | unset | no | Alias for `LANGFUSE_HOST`. The host wins. |
| `OTEL_SERVICE_NAME` | `stitcher-agent` | no | Service name in traces. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | no | Collector address. |
| `OTEL_SDK_DISABLED` | unset | no | `true` skips telemetry. Read by the OpenTelemetry SDK. |
| `OTEL_DIAG_DEBUG` | `false` | no | Print OpenTelemetry internal logs. |
| `MANIM_API_INDEX_PATH`, `MANIM_CHEATSHEET_PATH`, `RUFF_CONFIG_PATH`, `SKILLS_DIR` | bundled assets | no | Paths to bundled data. |
| `PYTHON_PATH` | `python3` | no | Python for validation. The image uses `/opt/validator/bin/python`. |
| `MANIM_PLUGINS_DIR` | none | no | Read only by `scripts/build_cheatsheet.py`. |

## 4. RAG (`services/rag`)

Read by `src/config.ts`. See `services/rag/.env.example` and its README.

| Variable | Default | Required | What it does |
|---|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017/?directConnection=true` | no | Must be MongoDB with Search, such as Atlas Local. |
| `MONGODB_DB_NAME` | `manimrag` | no | Database name. |
| `VECTOR_STORE` | `mongodb_atlas` | no | Only value. |
| `COLLECTION_NAME` | `manimrag_corpus` | no | Corpus collection. |
| `VECTOR_INDEX_NAME`, `TEXT_INDEX_NAME` | `manimrag_vector_index`, `manimrag_text_index` | no | Search index names. |
| `RAG_API_KEY` | none | yes, for HTTP | At least 16 characters. |
| `EMBEDDER_PROVIDER` | `local` | no | `local`, `openai`, `gemini` or `ollama`. |
| `EMBEDDER_MODEL` | provider default | no | `local`: `Xenova/bge-small-en-v1.5`. `openai`: `text-embedding-3-small`. `gemini`: `gemini-embedding-001`. `ollama`: `nomic-embed-text`. |
| `EMBEDDING_DIM` | from the model | for unknown models | Vector size. |
| `EMBEDDER_API_KEY`, `EMBEDDER_API_KEYS` | empty | for `openai`, `gemini` | Key, or a comma-separated list rotated per request. Falls back to `LLM_API_KEY`. |
| `EMBEDDER_BASE_URL` | provider endpoint | no | Custom endpoint. |
| `EMBED_BATCH_SIZE` | `100` | no | Texts per embedding request. |
| `MODELS_DIR` | `.models` | no | Where local weights live. The image uses `/app/models`. |
| `EMBEDDER_OFFLINE` | `false` | no | `true` blocks weight downloads. The image sets it. |
| `LOCAL_EMBED_DTYPE` | `q8` | no | `fp32`, `fp16`, `q8` or `q4`. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | no | OpenAI embeddings endpoint. |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | no | Gemini embeddings endpoint. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | no | Ollama embeddings endpoint. |
| `LLM_PROVIDER` | `openai` | no | Query transform provider: `openai`, `gemini`, `openrouter`, `ollama` or `opencodego`. |
| `LLM_API_KEY` | empty | for hosted LLM stages | Key for those stages. |
| `LLM_MODEL` | provider default | no | Model for those stages. |
| `LLM_BASE_URL` | provider default | no | Endpoint for those stages. |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | no | OpenCode Go endpoint. |
| `OPENCODE_DISABLE_THINKING` | `true` | no | OpenCode Go only. |
| `ALLOWED_LLM_BASE_URLS` | empty | no | Comma-separated prefixes allowed for per-request base URLs. Empty allows any. |
| `RERANKER_PROVIDER`, `RERANKER_MODEL`, `RERANKER_BASE_URL`, `RERANKER_API_KEY` | from `LLM_*` | no | Reranker target. |
| `RERANKER_TOP_N` | `5` | no | Documents kept after reranking. |
| `STAGE_QUERY_TRANSFORM` | `false` | no | Rewrite the prompt and return `requiredPlugins`. Compose sets `true`. |
| `STAGE_SPARSE` | `false` | no | Add text search with rank fusion. |
| `STAGE_RERANK` | `false` | no | Rerank with an LLM. |
| `STAGE_PITFALLS` | `true` | no | Add curated pitfalls to the context. |
| `DEFAULT_TOP_K` | `5` | no | Examples returned. |
| `DENSE_TOP_K`, `DENSE_NUM_CANDIDATES` | `40`, `200` | no | Vector search size. |
| `SPARSE_TOP_K` | `40` | no | Text search size. |
| `RERANK_CANDIDATES`, `RERANK_DOC_CHARS` | `20`, `600` | no | Reranker input size. |
| `RRF_K` | `60` | no | Rank fusion constant. |
| `QUERY_TRANSFORM_TIMEOUT_MS` | `2200` | no | Compose sets `6000`. |
| `EMBED_TIMEOUT_MS`, `EMBED_BATCH_TIMEOUT_MS` | `8000`, `30000` | no | Embedding time limits. |
| `VECTOR_SEARCH_TIMEOUT_MS` | `5000` | no | Search time limit. |
| `RERANK_TIMEOUT_MS` | `4000` | no | Rerank time limit. |
| `RETRY_MAX`, `RETRY_BASE_MS` | `3`, `300` | no | Retry count and first backoff. |
| `LOG_LEVEL` | `info` | no | `trace`, `debug`, `info`, `warn` or `error`. |
| `PORT`, `HOST` | `7000`, `0.0.0.0` | no | Listen address. |
| `RATE_LIMIT_MAX` | `120` | no | Requests per minute. |
| `OTEL_SDK_DISABLED` | `false` | no | `true` skips telemetry. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | no | Collector address. |
| `OTEL_SERVICE_NAME` | `stitcher-rag` | no | Service name in traces. |
| `OTEL_DIAG_DEBUG` | `false` | no | Print OpenTelemetry internal logs. |

The `rag-seed` job reads the same `MONGODB_URL`, `EMBEDDER_*`, `EMBEDDING_DIM`, `MODELS_DIR` and `LOG_LEVEL`.

## 5. Render (`services/render`)

Read by `app/config.py` and `app/observability.py`. See `services/render/.env.example`.

| Variable | Default | Required | What it does |
|---|---|---|---|
| `RENDER_API_KEY` | none | yes | Secret for `X-Api-Key`. At least 16 characters. |
| `ENV` | `dev` | no | `dev`, `staging` or `production`. `production` refuses `SANDBOX_ENABLED=false`. |
| `LOG_LEVEL` | `INFO` | no | `DEBUG`, `INFO`, `WARNING` or `ERROR`. Upper case. |
| `LOG_FORMAT` | `json` | no | `json` or `text`. |
| `SANDBOX_ENABLED` | `true` | no | Run Manim in bubblewrap. |
| `SANDBOX_TIMEOUT_DEFAULT` | `120` | no | Seconds per render. |
| `SANDBOX_MEMORY_MB_DEFAULT` | `2048` | no | Memory cap per render, in MB. |
| `SANDBOX_CPU_DEFAULT` | `1.5` | no | CPUs, used to size the CPU-time limit. |
| `MAX_CONCURRENT_RENDERS` | CPU count | no | Renders at once. More requests get 503. |
| `QUEUE_FULL_POLICY` | `reject` | no | `reject` or `block`. |
| `QUEUE_WAIT_TIMEOUT_SEC` | `30` | no | How long `block` waits. |
| `MAX_CODE_BYTES` | `524288` | no | Largest code body. |
| `MAX_AUDIO_BYTES` | `10485760` | no | Largest voiceover bundle. |
| `MAX_TIMEOUT_SEC` | `600` | no | Upper bound for a request timeout. |
| `STORAGE_BACKEND` | `local` | no | `local` or `cloudinary`. |
| `LOCAL_STORAGE_PATH` | `/tmp/renders` | no | Folder for local files, served at `/files`. |
| `LOCAL_STORAGE_PUBLIC_URL_BASE` | `file://` | no | URL prefix for returned files. Must be reachable by the API. |
| `CLOUDINARY_URL` | unset | with `cloudinary` | `cloudinary://<key>:<secret>@<cloud>`. Build with `STORAGE=cloudinary`. |
| `MANIM_PATH`, `PYTHON_PATH`, `FFMPEG_PATH` | image paths | no | Tool locations. |
| `METRICS_ENABLED` | `true` | no | Serve `/metrics`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | no | Collector address. |
| `OTEL_SERVICE_NAME` | `stitcher-render` | no | Service name in traces. |
| `OTEL_SDK_DISABLED` | unset | no | `true` skips telemetry. |

Build arguments for the image: `STORAGE` (`cloudinary` adds the SDK), `SLIM` (`1` drops texlive-science and vedo),
`APT_MIRROR`, `PIP_INDEX_URL`.

## 6. Web (`apps/web`)

Read by Vite at build time, so rebuild the image after a change.

| Variable | Default | What it does |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3000/api` | API address, including `/api`. A path such as `/api` means the same origin as the page. The Docker image builds with `/api`. |
| `VITE_GOOGLE_CLIENT_ID` | empty | Google client id. Empty hides the button. Compose passes `GOOGLE_CLIENT_ID`. |
