# Manim Agent Service

A standalone HTTP service that turns a natural-language prompt into validated Manim Python scenes, or fixes broken Manim code.

**Input:** `POST /generate` with a prompt (and optional RAG context)
**Output:** N complete, statically-validated Manim `.py` files — one class per scene

Zero rendering. Zero RAG. Zero database. Pure `(prompt | broken_code) → code`.

---

## Architecture

The agents are exposed as **independent endpoints** so an external orchestrator
(e.g. the stitcher) can run RAG / rendering as separate services.

```
POST /plan                  ──→  Planner Agent  ──→ scenes[] + styleManifest
POST /code  (per scene)     ──→  Coder + Validator + Refiner loop  ──→ final code
POST /debug                 ──→  Debugger + Validator loop  ──→ fixed code

POST /generate              ──→  legacy convenience: plan → code-per-scene end-to-end
```

Recommended orchestration (the service does NOT do RAG itself):

```
prompt
  │
  ▼
POST /plan ──→ scenes[] (each with description, concepts, visualElements)
  │
  ▼  for each scene
RAG service (separate) ──→ codeExamples[]   (parent NLP doc → child code)
  │
  ▼
POST /code  (scenePlan + styleManifest + codeExamples)
  │
  ▼
Renderer service (separate) ──→ MP4
```

Validator pipeline (deterministic, no LLM):
`ast → apiSurface → pyflakes → ruff → compile → manimLint → sceneClass`

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

### `POST /plan`

Runs the planner agent only. Returns a list of scene plans + a style manifest.
Each scene plan exposes `description`, `concepts`, and `visualElements` for an
external RAG service to use as retrieval queries.

```bash
curl -X POST http://localhost:4000/plan \
  -H "X-Api-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain binary search on a sorted array",
    "modelConfig": {
      "planner": { "provider": "openai", "model": "gpt-4o", "apiKey": "sk-..." }
    },
    "constraints": { "maxScenes": 3 }
  }'
```

Response:

```json
{
  "success": true,
  "jobId": "...",
  "output": {
    "scenes": [
      {
        "index": 0,
        "prompt": "Show a sorted array with markers at left, mid, right",
        "description": "An array of boxes appears, each labeled with a number...",
        "concepts": ["binary search", "sorted array", "pointers"],
        "visualElements": ["row of boxes", "left/right pointers", "highlighted mid"],
        "durationSec": 8,
        "manimFeatures": ["Rectangle", "Text", "FadeIn"],
        "requiredSymbols": ["Scene", "Rectangle", "Text", "FadeIn"]
      }
    ],
    "styleManifest": { "...": "..." }
  }
}
```

### `POST /code`

Runs the coder + validator/refiner loop for ONE scene. The orchestrator passes
the scene plan from `/plan`, the style manifest, and code examples that an
external RAG service has already retrieved.

```bash
curl -X POST http://localhost:4000/code \
  -H "X-Api-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "scenePlan": { "index": 0, "prompt": "...", "durationSec": 8, "manimFeatures": [...], "requiredSymbols": [...] },
    "styleManifest": { "...": "..." },
    "codeExamples": [
      { "description": "Draw a row of squares", "code": "from manim import *\n..." }
    ],
    "modelConfig": {
      "coder": { "provider": "openai", "model": "gpt-4o", "apiKey": "sk-..." }
    },
    "limits": { "maxValidationRetries": 3 }
  }'
```

Response:

```json
{
  "success": true,
  "jobId": "...",
  "output": {
    "sceneIndex": 0,
    "sceneClass": "Scene00",
    "code": "from manim import *\nclass Scene00(Scene):\n    ...",
    "status": "done",
    "attempts": [...]
  }
}
```

### `POST /generate` (legacy convenience)

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

The service has **no built-in RAG**. RAG is expected to be a separate service.

**Recommended flow** (per scene):

1. Call `POST /plan` with the user prompt → get scenes[] + styleManifest.
2. For each scene, build a RAG query from `scene.description` + `scene.concepts`
   + `scene.visualElements` and ask your RAG service for relevant code
   examples. The recommended store shape is parent–child: parent doc is an NLP
   description (e.g. *"Draw red circle animation"*), child is the corresponding
   Manim code.
3. Call `POST /code` with `scenePlan`, `styleManifest`, and `codeExamples` —
   an array of `{ description, code }` from RAG. The coder uses these as
   ground-truth templates.

**Legacy** `POST /generate` also accepts a `context.retrievalContext` blob
(`apiExamples`, `similarScripts`, `styleRecommendations`, `pitfalls`) for
backwards compatibility, but new integrations should use `/plan` + `/code`.

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
