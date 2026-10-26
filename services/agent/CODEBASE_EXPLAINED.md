# Manim Agent Service — Complete Codebase Explained

This document explains every part of the service from first principles. No assumed prior knowledge.

---

## The One-Line Summary

You send a text prompt like _"explain binary search"_. The service uses AI agents to write Manim Python code for you — broken into multiple scenes, validated to actually be correct Python, and returned as source code. It never renders video. It just produces the code that a render service (your Stitcher backend) would then run.

---

## Part 1: The Big Picture

### What problem are we solving?

Manim is a Python library for creating math animations. Writing correct Manim code is hard:
- You have to know which classes exist (`Circle`, `MathTex`, `Axes` — there are 400+)
- You have to structure code in a specific way (`class MyScene(Scene): def construct(self):`)
- LLMs hallucinate Manim class names that don't exist (`Squaer` instead of `Square`)
- One syntax error breaks the whole file

This service solves that by:
1. Planning what scenes to make (using AI)
2. Writing the code for each scene (using AI)
3. **Automatically checking the code** without running it
4. **Fixing the code** if it fails the check
5. Returning only code that passed all checks

### What it is NOT

- It does not render video (no ffmpeg, no Manim execution)
- It does not know about users, databases, credits, or Stitcher's internal state
- It does not store conversation history
- It is a pure function: you send a prompt → you get code back

### How Stitcher uses it

The recommended flow exposes each agent as an independent endpoint so the
stitcher orchestrates, and RAG / rendering live in their own services:

```
User types prompt
      ↓
Stitcher backend (Python/FastAPI)
      ↓
  POST /plan   →  scenes[] (each with description, concepts, visualElements)
      ↓
  for each scene:
      RAG service (separate)  →  codeExamples[] (parent NLP doc → child code)
      ↓
      POST /code  (scenePlan + styleManifest + codeExamples)  →  scene N code
      ↓
      Renderer service (separate)  →  scene N MP4
      ↓
  Stitch MP4s → User sees video
```

The legacy `POST /generate` runs plan + code-per-scene end-to-end inside this
service — kept for backwards compatibility but new integrations should call
`/plan` and `/code` directly.

---

## Part 2: The Request Flow (what happens when you call POST /generate)

Here is every step in order:

```
1. You call POST /generate with a prompt
2. Service validates your request (schema check)
3. Service checks your API key (X-Api-Key header)
4. A unique Job ID is created (e.g. "job_abc123")
5. Service immediately returns 202: { jobId, streamUrl, syncUrl }
6. In the background, the AI pipeline starts...

   ┌─ PLANNER AGENT ─────────────────────────────────────────────┐
   │ - Reads your prompt                                          │
   │ - Decides: how many scenes? what does each one show?        │
   │ - Creates a "style manifest" (colors, fonts, positions)     │
   │ - Uses manim_api_check tool to verify symbols exist         │
   │ - Outputs: scene plan (JSON) + style manifest (JSON)        │
   └──────────────────────────────────────────────────────────────┘
              ↓ (fan-out — all scenes run at the same time)
   ┌─ CODEGEN AGENT (scene 0) ─┐  ┌─ CODEGEN AGENT (scene 1) ─┐
   │ - Gets: scene plan[0]     │  │ - Gets: scene plan[1]     │
   │ - Writes Python code      │  │ - Writes Python code      │
   │ - Uses ast_preview tool   │  │ - Uses ast_preview tool   │
   │ - Outputs: .py file       │  │ - Outputs: .py file       │
   └───────────────────────────┘  └───────────────────────────┘
              ↓ (both finish, then validation runs)
   ┌─ VALIDATOR (deterministic — no AI) ────────────────────────┐
   │ Check 1: ast        — is the Python syntax valid?           │
   │ Check 2: pyflakes   — any undefined variables?              │
   │ Check 3: ruff       — style/security rules                  │
   │ Check 4: compile    — can Python compile this to bytecode?  │
   │ Check 5: manimLint  — any banned imports (subprocess, etc.) │
   │ Check 6: sceneClass — does class Scene00(Scene) exist?      │
   └──────────────────────────────────────────────────────────────┘
              ↓ pass?  → done      fail? ↓
   ┌─ REFINER AGENT ─────────────────────────────────────────────┐
   │ - Gets: broken code + which check failed + why              │
   │ - Fixes the code                                            │
   │ - Re-runs validator                                         │
   │ - Retries up to 3 times                                     │
   └──────────────────────────────────────────────────────────────┘
              ↓
7. Job complete → final state saved to Redis → SSE stream closes
8. You poll GET /jobs/job_abc123 or watch GET /stream/job_abc123
```

---

## Part 3: LangGraph — Why It's Here

### What is LangGraph?

LangGraph is a library that lets you build AI pipelines as a **graph** (nodes connected by edges) instead of writing a big chain of function calls.

Think of it like this: instead of writing:

```typescript
const plan = await planner(prompt);
const code0 = await codeGen(plan[0]);
const code1 = await codeGen(plan[1]);
const result0 = await validate(code0);
if (!result0.passed) { const fixed = await refine(code0, result0); ... }
```

You define a **graph** where each box is a node and the arrows are edges:

```
START → planner → parallelCodeGen → validateAndRefine → aggregate → END
```

LangGraph then:
- Runs each node in order
- Handles errors and retries
- Maintains a shared "state object" that every node reads from and writes to
- Lets you define conditional edges ("if planner errored → go to END, otherwise → go to codeGen")

### Where is the graph defined?

`src/graph/generateGraph.ts` — the main generate pipeline  
`src/graph/debugGraph.ts` — the debug/fix pipeline

### What is the "state"?

`src/graph/state.ts` — This is the shared object that all graph nodes read and write.

Think of it as a shared whiteboard. When the planner runs, it writes `scenes` and `styleManifest` to the whiteboard. When codeGen runs, it reads those and writes `sceneStates` back. When the validator runs, it reads `sceneStates` and updates the status of each scene.

The state object looks like this:

```typescript
{
  jobId: "job_abc123",
  mode: "generate",
  prompt: "explain binary search",
  
  // Written by planner
  styleManifest: { backgroundColor: "#1a1a2e", primaryColor: "#3B82F6", ... },
  scenes: [
    { index: 0, prompt: "Show a sorted array", durationSec: 8, manimFeatures: ["NumberLine"] },
    { index: 1, prompt: "Show the search algorithm", durationSec: 10, manimFeatures: ["Indicate"] },
  ],
  
  // Written by codeGen + validator + refiner
  sceneStates: {
    0: { status: "done", finalCode: "from manim import *\nclass Scene00..." },
    1: { status: "failed", finalCode: null },
  },
  
  events: [...],      // every event emitted during this job
  llmCallLog: [...],  // every LLM call with token counts
}
```

### What does "Annotation" mean in the state file?

LangGraph requires you to tell it: "when two nodes both write to the same field, how do you merge them?"

For example, two codeGen agents both write to `sceneStates`. Without a merge rule, one would overwrite the other. The Annotation defines: "for `sceneStates`, merge the two objects together" (scene 0's result + scene 1's result → combined object).

```typescript
// In state.ts — this tells LangGraph: merge scene states, don't replace them
sceneStates: Annotation<Record<number, SceneState>>({
  reducer: (a, b) => ({ ...a, ...b }),  // merge
})
```

---

## Part 4: The Agents — What Each One Does

There are 4 agents. Each one is an AI that has tools it can call before responding.

### Agent pattern

All 4 agents use the same pattern — `createReactAgent`:

```
User message → Agent thinks → calls a tool? → gets result → thinks again → final answer
```

This is called a "ReAct" loop (Reasoning + Acting). The agent reasons about what to do, acts by calling a tool, observes the result, and repeats until it decides to stop.

### 1. Planner (`src/agents/planner.ts`)

**Job:** Turn a prompt into a structured plan.

**Reads:** prompt, constraints (min/max scenes), user preferences, retrieval context  
**Writes to state:** `styleManifest` + `scenes[]`

**Tools it can use:**
- `manim_api_check` — "does `FancyArrow` exist in Manim?" before including it in the plan
- `web_search` (optional, off by default) — for niche topics where the LLM might not know the math

**What the planner outputs:** Two JSON blocks embedded in its text response:

```
```json style_manifest        ← Claude/GPT writes this literal text
{
  "backgroundColor": "#1a1a2e",
  "primaryColor": "#3B82F6",
  ...
}
```

```json scene_plan
[
  { "index": 0, "prompt": "Show the array", "durationSec": 8, "manimFeatures": ["NumberLine", "Indicate"] }
]
```
```

The code then parses these JSON blocks out of the response text using regex.

### 2. CodeGen (`src/agents/codeGen.ts`)

**Job:** Write Python code for ONE scene.

**Reads:** `scenes[i]` (its specific scene plan), `styleManifest`, `retrievalContext`  
**Writes to state:** `sceneStates[i]` — the code it produced

**Tools it can use:**
- `manim_api_check` — "does `ParametricFunction` exist?" before using it
- `ast_preview` — runs `ast.parse()` on its own draft to check the structure

**Class naming rule:** The class name is always `Scene00`, `Scene01`, `Scene02`, etc. (zero-padded). This is enforced both in the system prompt and in the validator. This matters because the render service needs to know which class to render.

**What the codeGen outputs:** A Python code block:

```
```python
from manim import *

class Scene00(Scene):
    def construct(self):
        self.camera.background_color = ManimColor("#1a1a2e")
        circle = Circle(color="#3B82F6")
        self.play(Create(circle))
        self.wait(1)
```
```

### 3. Refiner (`src/agents/refiner.ts`)

**Job:** Fix code that failed validation. Called automatically, not by external API.

**Reads:** failing code + the validation report (which check failed, at which line)  
**Writes to state:** `sceneStates[i]` with new code + updated status

**Tools:** same as codeGen — `manim_api_check`, `ast_preview`

**Key behavior:** The refiner sees the exact error message from the validator. If the check was `manimLint` and the error is "subprocess is not allowed", the refiner knows specifically what to remove.

### 4. Debugger (`src/agents/debugger.ts`)

**Job:** Fix code that ALREADY FAILED AT RENDER TIME (post-execution errors). This is what `POST /debug` calls.

**Different from refiner:** The refiner fixes code that failed static analysis (never ran). The debugger fixes code that actually ran in Manim and crashed — it gets the real stderr output.

**Tools:** `manim_api_check`, `ast_preview`, `diff` (to show what changed)

**What it outputs:** Fixed code + a change summary + a unified diff showing before/after.

---

## Part 5: The Validator — The Most Important Part

The validator is **not an AI**. It's a deterministic code checker. It runs the same checks every time and always gives the same answer for the same code.

### Why is this important?

AI agents hallucinate. Without validation:
- The codeGen might write `class Scene00(Screen):` (wrong base class)
- The codeGen might write `import subprocess` (dangerous)
- The codeGen might write Python with a missing `:` at the end of an if statement

The validator catches all of this before returning to the caller.

### How it works (two parts)

**TypeScript side** (`src/validation/pipeline.ts`):
- Extracts capitalized words from the code (potential Manim class names)
- Checks them against the 403-symbol index
- Calls the Python runner

**Python side** (`src/validation/runner.py`):
- Receives the code via stdin as JSON
- Runs 6 checks in order
- Stops at the first failure (fail-fast)
- Returns results as JSON to stdout

### The 6 checks in order

1. **ast** — Python's built-in `ast.parse()`. Catches syntax errors like missing colons, unclosed brackets. Returns the line number.

2. **pyflakes** — Like a spell-checker for Python. Catches `undefined name 'Circle'`, `imported but unused`, etc.

3. **ruff** — A Python linter. Faster than flake8. Configured with a Manim-specific config (`ruff_manim.toml`) that turns off rules that conflict with Manim's style (like "don't use star imports" — Manim requires `from manim import *`).

4. **compile** — Python's `compile()` function turns source code into bytecode. Catches errors that `ast.parse()` sometimes misses at the bytecode level.

5. **manimLint** — A custom check we wrote. Scans the code for banned patterns:
   - `import subprocess`
   - `import socket`
   - `import os`
   - `open(` (file system access)
   - `eval(`
   - `exec(`
   - `__import__(`

6. **sceneClass** — Checks that a class with the expected name (e.g. `Scene00`) that inherits from `Scene` and has a `construct(self)` method actually exists.

### The 403-symbol index

File: `src/assets/manim_api_index.json`

This is a pre-built dictionary of every class, function, and constant in the installed version of Manim. Built by running `scripts/build_manim_api_index.py` against the actual manim package.

```json
{
  "Circle": { "signature": "Circle(radius=1.0, color=WHITE, ...)", "module": "manim.mobject.geometry.arc" },
  "MathTex": { "signature": "MathTex(*tex_strings, ...)", "module": "manim.mobject.text.tex_mobject" },
  ...403 symbols total...
}
```

When the codeGen writes `FancyArrow()`, the validator checks the index → not found → suggests `Arrow` instead.

---

## Part 6: Tools — What Each One Does

Tools are functions that agents can call mid-response. Think of them like the agent having access to a calculator.

### `manim_api_check` (`src/tools/manimApiCheck.ts`)

The agent calls this when it's about to use a Manim class and wants to confirm it exists:

```
Agent: "I want to use `ParametricCurve`. Let me check..."
→ calls manim_api_check({ symbols: ["ParametricCurve"] })
← { valid: false, missing: ["ParametricCurve"], suggestions: ["ParametricFunction"] }
Agent: "It doesn't exist. I'll use ParametricFunction instead."
```

Also has a TypeScript function `checkSymbolsSync()` for the validator to use directly (without the tool overhead).

### `ast_preview` (`src/tools/astPreview.ts`)

The agent calls this on draft code to check its structure without running it:

```
Agent: "Let me verify my class name is correct..."
→ calls ast_preview({ code: "from manim import *\nclass Scene00..." })
← { classes: ["Scene00"], imports: ["manim"], functions: ["construct"], error: null }
Agent: "Good. Class name is Scene00, imports look right."
```

This runs Python as a subprocess: `python3 -c "import ast; ast.parse(code)"` and returns a JSON summary.

### `web_search` (`src/tools/webSearch.ts`)

Optional. Off by default (`ENABLE_WEB_SEARCH=false`).

When enabled, the planner can call this for niche topics:
```
Planner: "The user wants me to explain Fourier transforms. Let me search for the math..."
→ calls web_search({ query: "discrete fourier transform visual explanation" })
← { results: [{ title: "...", url: "...", snippet: "..." }] }
```

Supports three backends (configured by env var):
- **Tavily** — an AI-focused search API
- **Serper** — Google Search API wrapper
- **Brave** — Brave's search API

Rate-limited: at most 3 calls per job by default (`WEB_SEARCH_MAX_CALLS_PER_JOB`).

### `diff` (`src/tools/diff.ts`)

Only the debugger uses this. After fixing broken code, it generates a before/after diff so the caller can show what changed:

```
--- before
+++ after
@@ -4,4 +4,4 @@
     def construct(self):
-        self.play(FadeIn(Squaer()))
+        self.play(FadeIn(Square()))
```

---

## Part 7: SSE — Real-Time Progress Updates

### What is SSE?

Server-Sent Events. It's a way for the server to push updates to the client over a long-lived HTTP connection. Think of it like a one-way WebSocket — the server keeps sending events, the client just listens.

### Why use it here?

LLM calls take 5–30 seconds each. A 4-scene video might take 60–90 seconds total. Without SSE, the user would just see a spinner. With SSE, you can show:

```
✓ Planning scenes...
✓ Plan complete: 3 scenes
⟳ Generating scene 1/3...
⟳ Generating scene 2/3...
✓ Scene 1 generated
✓ Scene 2 generated  
⟳ Validating scene 1...
✓ Scene 1 passed
⟳ Validating scene 2... ← validator found an error, running refiner
⟳ Fixing scene 2 (attempt 1/3)...
✓ Scene 2 fixed and validated
✓ Complete!
```

### How it works technically

**Event emitter** (`src/events/emitter.ts`):
Each job gets its own `EventEmitter` (like a radio station for that job). Any part of the code can broadcast an event: `publishEvent(jobId, "planner_complete", { sceneCount: 3 })`.

**SSE transport** (`src/events/sseTransport.ts`):
When a client connects to `GET /stream/job_abc123`, this code:
1. Sets the right HTTP headers (`Content-Type: text/event-stream`)
2. Subscribes to that job's event emitter
3. Forwards every event to the client as `data: {...}\n\n`
4. Sends a heartbeat every 15 seconds (so the connection doesn't time out)
5. Closes the connection when `job_complete` or `job_failed` arrives

**Format on the wire:**
```
data: {"type":"planner_started","jobId":"abc123","timestamp":"2025-12-15T..."}

data: {"type":"heartbeat","jobId":"abc123","timestamp":"..."}

data: {"type":"job_complete","jobId":"abc123","output":{...}}
```

### What events exist?

```
job_started         ← immediately when job is created
planner_started     ← when planner agent begins
planner_complete    ← planner done, includes sceneCount
codegen_started     ← when codeGen starts for scene N
codegen_complete    ← codeGen done for scene N
validator_started   ← when validator runs on scene N
validator_result    ← passed or failed, includes which checks failed
validator_retrying  ← refiner is being called (with attempt number)
job_complete        ← all done, includes full output
job_failed          ← something went wrong
job_cancelled       ← caller cancelled it
heartbeat           ← every 15s, keeps connection alive
```

---

## Part 8: Redis — What It's Doing

### What is Redis?

Redis is an in-memory key-value store. It's like a very fast dictionary that persists across server restarts and can be shared between multiple server instances.

### What do we use it for?

**Job checkpointing.** After each major step, we save the entire job state to Redis:

```typescript
// After planner finishes, save state
await saveJob(jobId, { ...state, styleManifest, scenes });

// After all codeGen finishes, save again
await saveJob(jobId, { ...state, sceneStates });
```

The data is stored as JSON with a 2-hour TTL (it auto-deletes after 2 hours):
```
Redis key: "job:job_abc123"
Redis value: "{...entire state JSON...}"
TTL: 7200 seconds
```

### Why do we need this?

Three reasons:

1. **Polling fallback** — `GET /jobs/job_abc123` hits Redis to return the current state to callers who aren't using SSE.

2. **Crash recovery** — If the Node.js server crashes mid-job, the partial state isn't completely lost. (Though currently we can't *resume* the graph from mid-point — that requires step-level checkpointing, which is a known gap.)

3. **Horizontal scaling** — If you run two instances of this service, both can read/write job state because it's in Redis, not in the Node.js process memory.

### What happens if Redis is down?

The service continues to work. The `saveJob` and `loadJob` functions have try/catch — they log a warning and silently fail. The SSE stream still works (it uses the in-memory event emitter, not Redis). The only thing that breaks is `GET /jobs/:id` polling.

---

## Part 9: Prompt Versioning — What This Means

### What is a "prompt"?

The system prompt is the instruction you give to the AI at the start of every conversation. It tells the AI what its role is, what rules to follow, and what format to output in.

For example, the planner's system prompt (`src/prompts/planner/v1_initial.md`) starts with:
```
You are a Manim video planner. Your job is to decompose a user's prompt into 
a structured scene plan that a code generator can turn into Manim Python code.

## Your outputs
You MUST produce two things in order: a StyleManifest and a scene list...
```

### Why version them?

Prompts change over time. You might:
- Find that the planner is generating too many scenes → add a rule
- Find that the coder forgets to set the background color → add it to the rules
- Try a completely different prompt structure to see if it produces better code

If you change the prompt directly and it makes things worse, you can't easily go back. Versioning solves this:

```
src/prompts/
  planner/
    v1_initial.md      ← current version
    v2_structured.md   ← future experiment
  coder/
    v1_initial.md
```

### How it works

Each prompt file has YAML "front matter" at the top:
```
---
role: planner
version: 1
name: initial
description: Decomposes a prompt into a scene plan
expected_models: ["gpt-4o", "gpt-4o-mini"]
token_budget: 2000
---

(system prompt text starts here)
```

The registry (`src/prompts/registry.ts`) loads the prompt file, strips the YAML front matter, and returns just the text. It caches results so it doesn't re-read files on every request.

You control which version is active via env vars:
```
PROMPT_VERSION_PLANNER=v1_initial   ← use v1
PROMPT_VERSION_PLANNER=v2_new       ← try v2
```

This means you can deploy a new prompt version without changing any code.

---

## Part 10: Provider Abstraction — How Multiple LLMs Work

### The problem

Every LLM provider has a different API:
- OpenAI: `openai.chat.completions.create(...)`
- Anthropic: `anthropic.messages.create(...)`
- Groq: same as OpenAI but different URL and key

If you hardcode OpenAI everywhere, switching to Anthropic means rewriting every agent.

### The solution: one interface, many implementations

`src/models/factory.ts` — the `getModel()` function takes a `ModelConfig` and returns a `BaseChatModel`. Every agent calls `getModel()` and only uses `BaseChatModel` methods — it never knows which actual API it's talking to.

```typescript
// Every agent does this:
const model = getModel(cfg);  // returns a BaseChatModel
const agent = createReactAgent({ llm: model, tools });
// agent.invoke() works the same regardless of whether cfg.provider is "openai" or "anthropic"
```

### The OpenAI-compatible trick

Many providers (Groq, OpenRouter, OpenCodeGo) support the exact same HTTP API as OpenAI — they just use a different URL and key. So `ChatOpenAI` from LangChain works for all of them if you just override the `baseURL`:

```typescript
// OpenAI
new ChatOpenAI({ openAIApiKey: "sk-...", modelName: "gpt-4o" })

// Groq — same library, different URL
new ChatOpenAI({
  openAIApiKey: "gsk_...",
  modelName: "llama-3.1-8b-instant",
  configuration: { baseURL: "https://api.groq.com/openai/v1" }
})

// OpenCodeGo — same library, different URL again
new ChatOpenAI({
  openAIApiKey: "ocg_...",
  modelName: "kimi-k2.5",
  configuration: { baseURL: "https://opencode.ai/zen/go/v1" }
})
```

### Per-request model config

The caller specifies the model per-request. You can use different models for different roles:

```json
{
  "modelConfig": {
    "planner":  { "provider": "anthropic", "model": "claude-3-5-haiku-latest" },
    "coder":    { "provider": "openai",    "model": "gpt-4o" },
    "debugger": { "provider": "groq",      "model": "llama-3.1-70b-versatile" }
  }
}
```

This means you can use a fast cheap model for planning and a powerful model for code generation.

---

## Part 11: The Full Directory Structure

```
Manim-Agent-Service/
│
├── src/
│   ├── index.ts               ← entry point, starts Fastify web server
│   ├── config.ts              ← reads all environment variables, validates required ones
│   ├── logging.ts             ← pino logger setup
│   │
│   ├── api/                   ← HTTP route handlers
│   │   ├── generate.ts        ← POST /generate
│   │   ├── debug.ts           ← POST /debug
│   │   ├── stream.ts          ← GET /stream/:jobId (SSE)
│   │   ├── jobs.ts            ← GET /jobs/:jobId, POST /jobs/:jobId/cancel
│   │   ├── health.ts          ← GET /health
│   │   └── capabilities.ts    ← GET /capabilities
│   │
│   ├── middleware/
│   │   ├── auth.ts            ← X-Api-Key header check
│   │   └── trace.ts           ← adds traceId to every request
│   │
│   ├── graph/                 ← LangGraph state machines
│   │   ├── state.ts           ← shared state type + LangGraph Annotation
│   │   ├── generateGraph.ts   ← planner→codeGen→validate→aggregate
│   │   ├── debugGraph.ts      ← debugger→validate→finalize
│   │   └── checkpointer.ts    ← save/load job state in Redis
│   │
│   ├── agents/                ← the 4 AI agents
│   │   ├── planner.ts         ← scene planning agent
│   │   ├── codeGen.ts         ← per-scene code generation agent
│   │   ├── refiner.ts         ← validation-failure fixer (internal)
│   │   └── debugger.ts        ← post-render error fixer (public API)
│   │
│   ├── tools/                 ← tools agents can call
│   │   ├── manimApiCheck.ts   ← check if Manim symbols exist
│   │   ├── astPreview.ts      ← structural analysis of Python code
│   │   ├── webSearch.ts       ← optional web search (Tavily/Serper/Brave)
│   │   └── diff.ts            ← unified diff between code versions
│   │
│   ├── validation/            ← deterministic code checker
│   │   ├── pipeline.ts        ← TypeScript orchestrator
│   │   └── runner.py          ← Python: ast, pyflakes, ruff, compile, manimLint
│   │
│   ├── events/                ← real-time event system
│   │   ├── emitter.ts         ← per-job EventEmitter registry
│   │   └── sseTransport.ts    ← streams events to HTTP client
│   │
│   ├── models/
│   │   └── factory.ts         ← getModel() — returns any LLM as BaseChatModel
│   │
│   ├── prompts/               ← system prompt files
│   │   ├── planner/v1_initial.md
│   │   ├── coder/v1_initial.md
│   │   ├── debugger/v1_initial.md
│   │   ├── refiner/v1_initial.md
│   │   └── registry.ts        ← loads + caches prompt files
│   │
│   └── assets/
│       ├── manim_api_index.json  ← 403 Manim symbols (pre-built)
│       └── ruff_manim.toml       ← ruff linter config for Manim code
│
├── tests/
│   ├── unit/           ← unit tests (no server, no LLM)
│   ├── contract/       ← HTTP tests (mocked LLM)
│   ├── integration/    ← graph tests (mocked LLM) — not written yet
│   └── golden/         ← golden prompt suite — not written yet
│
├── scripts/
│   └── build_manim_api_index.py  ← regenerates manim_api_index.json
│
├── Dockerfile            ← multi-stage build
├── docker-compose.yml    ← service + redis
├── .env.example          ← all env vars documented
└── package.json
```

---

## Part 12: The Dockerfile — How It Builds

The Dockerfile has 5 stages. This is called a "multi-stage build" — each stage builds on the previous one but only the final stage ends up in the actual Docker image. This keeps the image small.

```
Stage 1: base
  - Ubuntu with Python 3.11 + Node.js 20
  - Sets up working directory

Stage 2: pydeps
  - Installs manim, pyflakes, ruff into Python
  - Takes a long time (~10 min) — manim has many dependencies
  - This layer is cached — only re-runs if requirements change

Stage 3: nodedeps
  - Copies package.json
  - Runs npm ci (installs all Node packages)
  - Cached unless package.json changes

Stage 4: builder
  - Copies all TypeScript source
  - Runs tsc (TypeScript → JavaScript)
  - Runs build_manim_api_index.py to build the 403-symbol index
  - Output: compiled dist/ + manim_api_index.json

Stage 5: runtime (the actual image)
  - Copies only what's needed: Python env, Node modules, compiled dist
  - Does NOT include: TypeScript source, build tools, etc.
  - Final image is ~800MB (dominated by manim's Python dependencies)
```

---

## Part 13: Configuration — All the Knobs

Everything is controlled through environment variables. The service hard-crashes at startup if `AGENT_API_KEY` is missing. Everything else has a default.

| Variable | Default | What it does |
|---|---|---|
| `AGENT_API_KEY` | **required** | The key callers must pass in X-Api-Key header |
| `PORT` | 4000 | HTTP port |
| `CHECKPOINT_REDIS_URL` | redis://localhost:6379 | Where Redis is |
| `DEFAULT_PROVIDER` | openai | Which LLM to use if caller doesn't specify |
| `DEFAULT_MODEL_PLANNER` | gpt-4o | Default model for planner |
| `DEFAULT_MODEL_CODER` | gpt-4o | Default model for codeGen |
| `DEFAULT_MODEL_DEBUGGER` | gpt-4o | Default model for debugger |
| `OPENAI_API_KEY` | (none) | OpenAI key — or pass in request |
| `ANTHROPIC_API_KEY` | (none) | Anthropic key — or pass in request |
| `OPENCODE_GO_API_KEY` | (none) | OpenCodeGo key |
| `ENABLE_WEB_SEARCH` | false | Turn on web search tool for planner |
| `WEB_SEARCH_PROVIDER` | tavily | Which search backend |
| `MAX_PARALLEL_SCENES` | 6 | Max concurrent codeGen agents |
| `DEFAULT_MAX_VALIDATION_RETRIES` | 3 | How many times refiner retries |
| `DEFAULT_TIMEOUT_SEC` | 120 | Kill job after this many seconds |
| `LOG_LEVEL` | info | trace/debug/info/warn/error |
| `PYTHON_PATH` | python3 | Path to Python with manim/pyflakes/ruff installed |

---

## Part 14: What's NOT Built (Known Gaps)

These were explicitly planned but not implemented yet. In priority order:

**High priority — needed before production:**

1. **SSE event replay on reconnect** — If your browser disconnects mid-job and reconnects with `Last-Event-ID: 5`, you don't get back the 5 events you missed. Events are only in memory. Fix: write events to Redis per-job and replay on reconnect.

2. **Rate limiting** — Currently any caller can send 1000 requests per second and the service accepts them all. Fix: `@fastify/rate-limit` middleware.

3. **Cancel actually interrupts LLM** — Currently `POST /jobs/:id/cancel` sets a flag, but the running LLM call finishes before checking the flag. Fix: `AbortController` passed to the LLM call.

**Medium priority:**

4. **Step-level graph checkpointing** — If the server crashes while codeGen is running, the job is lost even though the planner already finished. Currently only job-level state is saved. Fix: LangGraph's Redis checkpointer for per-node state.

5. **Integration tests** — The `tests/integration/` folder exists but is empty. No tests drive the full graph with a mocked LLM.

6. **Langfuse tracing** — The config keys are there (`LANGFUSE_SECRET_KEY` etc.) but nothing actually sends traces to Langfuse.

---

## Part 15: The Two Endpoints — When to Call Which

### `POST /generate` — you have a prompt

Call this when the user wants new code from scratch.

```json
{
  "prompt": "explain binary search on a sorted array",
  "modelConfig": { "planner": {...}, "coder": {...} },
  "context": { "retrievalContext": { "apiExamples": [...] } },
  "constraints": { "maxScenes": 3 }
}
```

Returns multiple scenes (each is a complete Python file).

### `POST /debug` — you have broken code + the error

Call this when Manim already ran the code, it crashed, and you have the stderr output.

```json
{
  "brokenCode": "from manim import *\nclass ...",
  "error": {
    "stderr": "NameError: name 'Squaer' is not defined",
    "summary": "NameError on line 4",
    "line": 4
  },
  "originalPrompt": "fade in a blue square",
  "modelConfig": { "debugger": {...} }
}
```

Returns a single fixed Python file + what changed + a diff.

### The difference in the AI pipeline

- `/generate` runs: **planner** → **codeGen × N** → **validator** → **refiner (if needed)**
- `/debug` runs: **debugger** → **validator** → **retry (if needed)**

The debugger gets the real Manim error message. The refiner only gets static analysis results. This is why they're separate.
