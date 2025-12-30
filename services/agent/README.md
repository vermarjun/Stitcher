# Manim Agent Service

A standalone HTTP service that turns a natural-language prompt into validated Manim Python scenes, or fixes broken Manim code.

**Input:** `POST /generate` with a prompt (and optional RAG context)
**Output:** N complete, statically-validated Manim `.py` files — one class per scene

Zero rendering. Zero RAG. Zero database. Pure `(prompt | broken_code) → code`.

---

## Architecture

```
POST /generate
    │
    ▼
Planner Agent ──── tools: manim_api_check, web_search (opt)
    │
    ├─── CodeGen 0 ──┐
    ├─── CodeGen 1 ──┤  (parallel, up to MAX_PARALLEL_SCENES)
    └─── CodeGen N ──┘
          │
    Validator (deterministic, no LLM)
    ast → apiSurface → pyflakes → ruff → compile → manimLint → sceneClass
          │         │
         pass      fail → Refiner Agent → Validator (retry loop)
          │
    Aggregate → job_complete SSE event

POST /debug
    │
    Debugger Agent → Validator → (retry loop) → fixed code
```

**Tech stack:** TypeScript + Fastify + LangGraph + LangChain (OpenAI/Anthropic/Gemini adapters) + Redis + Python subprocess for validation

---

## Quick start

```bash
cp .env.example .env
# Edit .env — set AGENT_API_KEY and at least one provider key

docker compose up
```

Service runs on port 4000.

---

## API

### `POST /generate`

```bash
curl -X POST http://localhost:4000/generate \
  -H "X-Api-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain binary search on a sorted array",
    "modelConfig": {
      "planner":  { "provider": "openai",    "model": "gpt-4o",      "apiKey": "sk-..." },
      "coder":    { "provider": "opencodego","model": "kimi-k2.5",   "apiKey": "sk-..." },
      "debugger": { "provider": "anthropic", "model": "claude-3-5-haiku-latest", "apiKey": "sk-ant-..." }
    },
    "constraints": { "maxScenes": 3 }
  }'
```

Returns `202` with `{ jobId, streamUrl, syncUrl }`.

Stream progress:
```bash
curl -N http://localhost:4000/stream/<jobId> -H "X-Api-Key: your-key"
```

### `POST /debug`

```bash
curl -X POST http://localhost:4000/debug \
  -H "X-Api-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "brokenCode": "from manim import *\nclass S(Scene):\n    def construct(self):\n        self.play(FadeIn(Squaer()))",
    "sceneClass": "S",
    "error": { "stderr": "NameError: name 'Squaer' is not defined", "summary": "NameError", "line": 3 }
  }'
```

### `GET /stream/:jobId`

Server-Sent Events. Events:
- `job_started`, `job_complete`, `job_failed`, `job_cancelled`
- `planner_started`, `planner_complete`
- `codegen_started`, `codegen_complete`
- `validator_started`, `validator_result`, `validator_retrying`
- `debugger_started`, `debugger_complete`
- `heartbeat` (every 15s)

### `GET /jobs/:jobId`

Polling fallback. Returns the full job state.

### `POST /jobs/:jobId/cancel`

Cancel an in-flight job.

### `GET /capabilities`

Returns supported providers, tools, and limits.

### `GET /health`

Returns service health including Redis connectivity.

---

## Supported providers

| Provider | `"provider"` value | Notes |
|---|---|---|
| OpenAI | `"openai"` | GPT-4o, o1, etc. |
| Anthropic | `"anthropic"` | Claude 3.5, claude-opus-4-7, etc. |
| Google | `"gemini"` | Gemini 2.0 Flash, etc. |
| OpenRouter | `"openrouter"` | Routes to any model |
| Groq | `"groq"` | Ultra-fast inference |
| Ollama | `"ollama"` | Local; set `baseURL` |
| OpenCodeGo | `"opencodego"` | kimi-k2.5, minimax-m2.5, glm-5, mimo-v2-pro |
| AWS Bedrock | `"bedrock"` | Claude/Llama via AWS |

---

## Injecting RAG context

The service has no built-in RAG. If your upstream pipeline (e.g. Stitcher) does retrieval, inject results via `context.retrievalContext`:

```json
"context": {
  "retrievalContext": {
    "apiExamples": [{ "symbol": "ValueTracker", "snippet": "..." }],
    "similarScripts": [{ "prompt": "...", "code": "..." }],
    "styleRecommendations": ["use MathTex for equations"],
    "pitfalls": ["avoid ThreeDAxes at low quality"]
  }
}
```

---

## Configuration

See `.env.example` for all variables. Key ones:

| Variable | Default | Description |
|---|---|---|
| `AGENT_API_KEY` | required | Service authentication key |
| `CHECKPOINT_REDIS_URL` | `redis://localhost:6379` | Job state storage |
| `ENABLE_WEB_SEARCH` | `false` | Enable web search tool for planner |
| `WEB_SEARCH_PROVIDER` | `tavily` | `tavily` \| `serper` \| `brave` |
| `MAX_PARALLEL_SCENES` | `6` | Concurrent CodeGen workers |
| `DEFAULT_MAX_VALIDATION_RETRIES` | `3` | Refiner retry cap per scene |

---

## Development

```bash
npm install
cp .env.example .env   # fill in keys

# Run locally (needs Redis)
docker compose up redis -d
npm run dev

# Tests
npm test

# Type check
npm run typecheck

# Build manim API index (needs manim installed)
python3 scripts/build_manim_api_index.py
```

---

## Adding a provider

1. Add a `case` in `src/models/factory.ts`.
2. Add the string to `SUPPORTED_PROVIDERS`.
3. That's it — the factory is the only provider-specific file.

## Adding a validator check

1. Add a function in `src/validation/runner.py`.
2. Add the name to the `check_map` dict.
3. Add the name to the pipeline's `pythonChecks` array in `src/validation/pipeline.ts`.
