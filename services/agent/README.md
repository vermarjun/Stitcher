# Manim agent service

This Fastify service plans Manim scenes, writes Python, repairs code after render
errors, and extracts reusable lessons. Stitcher's API orchestrates retrieval,
voice synthesis, and rendering in separate services. This service accepts retrieved
examples and returns source code. Redis stores job snapshots; SSE events live in memory.

`src/agents` holds the planner, coder, debugger, and validation refiner.
`src/prompts/registry.ts` loads versioned Markdown prompts from role directories.
The voiceover coder uses `coder/v1_voiceover.md`. Plugin guides live in
`src/prompts/skills`; `requiredPlugins` selects guides to inject. The cheatsheet in
`src/assets/manim_cheatsheet.json` supplies API signatures and usage examples for
`requiredApis`. `coderMemory` supplies lessons from earlier failures. `/reflect`
has its own short system prompt in its route module.

The legacy `/generate` graph validates and refines generated scenes. `/code` makes
one coder completion; the caller handles subsequent validation and debug cycles.
Static validation runs Python syntax, pyflakes, ruff, bytecode compilation,
restricted-operation checks, expected scene class checks, and optional narration
beat checks. The API symbol index check is advisory. Validation does not import or
execute generated Manim code. The image bundles pyflakes and ruff; Manim belongs in
the render service.

## HTTP interface

Send `X-Api-Key: <AGENT_API_KEY>` on job routes. `/health` and `/capabilities` are public.
Requests and responses use JSON except SSE. Invalid bodies return HTTP 400.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /plan` | `{prompt, voiceover?, constraints?, modelConfig?}` | `{success, jobId, output: {scenes, styleManifest}, ...}` |
| `POST /code` | `{prompt, examples?: [{description,code}], requiredApis?: [], requiredPlugins?: [], voiceover?, coderMemory?: [], modelConfig?}` | `{success, jobId, output: {code,sceneClass}, tokensUsed, llmCallLog, ...}` |
| `POST /debug` | `{code, error?: string, prompt?, apiReference?: [], voiceover?, narration?: [], modelConfig?}` | `{success, jobId, output: {code,sceneClass,changeSummary}, tokensUsed, llmCallLog, ...}` |
| `POST /reflect` | `{prompt,originalCode,finalError?,debugHistory:[{code?,error?,changeSummary?}],modelConfig?}` | `{success,lesson,llmIO}` |
| `POST /generate` | `{prompt,voiceover?,constraints?,context?,modelConfig?}` | HTTP 202 `{jobId,streamUrl,syncUrl}`; `?wait=true` returns graph state |
| `GET /jobs/:jobId` | none | Stored job state, or HTTP 404 |
| `POST /jobs/:jobId/cancel` | none | `{cancelled:true,jobId}`; cancellation is cooperative |
| `GET /stream/:jobId` | none | SSE job and agent events with heartbeats |
| `GET /capabilities` | none | `{supportedProviders,supportedRoles,endpoints,validationTools,...}` |
| `GET /health` | none | `{status,checks:{redis,manimApiIndex},version}`; HTTP 503 if degraded |

`/code` also accepts legacy `scenePlan` and `codeExamples`. `/debug` accepts legacy
`brokenCode`, structured `error`, `sceneClass`, and `originalPrompt`.
`/code` and `/debug` default `voiceover` to true; `/plan` and `/generate` default it
to false. Voiceover plans include narration beats. Generated scenes use
`VoiceoverScene` and matching `self.voiceover(text=...)` blocks; audio is produced
by the caller's render pipeline.

`modelConfig` is keyed by role (`planner`, `coder`, `debugger`). Each role accepts
`{provider,model,apiKey?,baseURL?,temperature?,maxTokens?}`. Code, debug and reflect
also accept `params`. The default models by provider are listed together in
`src/config.ts`. Request settings override defaults. Set a key for the selected
provider or pass `apiKey` in the request. Missing keys fail on first model use.
Ollama needs no key and defaults to `http://localhost:11434/v1`.
Only `opencodego` receives `enable_thinking`.

## Build and checks

From `services/agent`:

```sh
npm ci
npx tsc --noEmit
npm test
```

Tests include unit tests and HTTP contract tests with mocked providers. They do
not need real LLM keys. The obsolete eval and unconfigured lint scripts were
removed. `npm run dev` runs TypeScript; `npm run build` compiles it and copies Markdown, Python, and JSON/TOML runtime
assets. Docker uses the same build command.

From the repository root:

```sh
docker build -t oss-agent-test services/agent
```

The TypeScript compile step peaks under 1 GB of memory.

The bundled `docker-compose.yml` defines the service and Redis. Set
`AGENT_API_KEY` and a provider key in its environment before starting it.
A standalone container can start without Redis, but `/health` is degraded and
job persistence requires `CHECKPOINT_REDIS_URL` to point to a reachable Redis.
For host Ollama from Docker Desktop, use `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1`.

## Rebuild the cheatsheet

From `services/agent`:

```sh
python3 scripts/build_cheatsheet.py --help
python3 scripts/build_cheatsheet.py --plugins-root ../render/vendor --out /tmp/oss-agent-cheatsheet.json
```

Omit `--out` to replace the checked-in cheatsheet. `MANIM_PLUGINS_DIR` also selects
the plugin root; `--plugins-root` takes precedence. The script combines the core
index with each plugin's `api_index.json` and optional `smoke_tests.py` examples.
Vendored plugins currently lack those indexes, so the command above warns and
produces 403 core entries only. Keep the shipped cheatsheet for full plugin
coverage unless supplying external plugin indexes. The build never regenerates it.

## Environment

See `.env.example` for the complete list. Paths default beside the executing
source or compiled module. Empty optional values use defaults.

| Variables | Required | Default / purpose |
| --- | --- | --- |
| `AGENT_API_KEY` | yes | Auth secret |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `OPENCODE_GO_API_KEY` | selected provider, unless passed in request | unset |
| `DEFAULT_PROVIDER` | no | `openai` |
| `DEFAULT_MODEL_PLANNER`, `DEFAULT_MODEL_CODER`, `DEFAULT_MODEL_DEBUGGER` | no | Selected provider's model in `src/config.ts` |
| `OLLAMA_BASE_URL` | no | `http://localhost:11434/v1` |
| `AWS_REGION` | no | `us-east-1`; Bedrock uses the AWS SDK credential chain |
| `HOST`, `PORT`, `NODE_ENV` | no | `0.0.0.0`, `4000`, `development` |
| `CHECKPOINT_REDIS_URL` | no | `redis://localhost:6379` |
| `ENABLE_WEB_SEARCH`, `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_MAX_CALLS_PER_JOB` | no | `false`, `tavily`, `3` |
| `TAVILY_API_KEY`, `SERPER_API_KEY`, `BRAVE_API_KEY` | selected search backend | unset |
| `MAX_PARALLEL_SCENES`, `DEFAULT_MAX_VALIDATION_RETRIES`, `DEFAULT_TIMEOUT_SEC`, `MAX_CODE_SIZE_BYTES` | no | `6`, `3`, `300`, `524288` |
| `PROMPT_VERSION_PLANNER`, `PROMPT_VERSION_CODER`, `PROMPT_VERSION_DEBUGGER`, `PROMPT_VERSION_REFINER` | no | `active` |
| `MANIM_API_INDEX_PATH`, `MANIM_CHEATSHEET_PATH`, `RUFF_CONFIG_PATH`, `SKILLS_DIR` | no | Bundled assets and prompts/skills |
| `PYTHON_PATH` | no | `python3`; image uses `/opt/validator/bin/python` |
| `LOG_LEVEL`, `CAPTURE_LLM_IO`, `LLM_IO_SINK`, `LLM_IO_LOCAL_PATH` | no | `info`, `false`, `local`, `./llm_captures` |
| `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` | no | Both unset disables callbacks |
| `LANGFUSE_HOST`, `LANGFUSE_BASEURL` | no | `https://cloud.langfuse.com`; HOST wins |
| `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_DIAG_DEBUG` | no | `stitcher-agent`, `http://localhost:4318`, `false` |
| `MANIM_PLUGINS_DIR` | no | Build script only: `../render/vendor` relative to service directory |
