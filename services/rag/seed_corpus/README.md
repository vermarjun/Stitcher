# Seed Corpus — ManimRAG Plugin Examples

Idempotent pipeline that generates, render-gates, and ingests plugin API examples
into the live RAG corpus. Re-running any step is safe.

## Directory layout

```
seed_corpus/
  examples/
    <plugin>/
      <api>/
        01.json … nn.json   # authored examples (verified flag written by render_and_verify.py)
  renders/
    <plugin>/<api>/01.mp4 … # render-verified videos for human review
  render_and_verify.py      # Step 1: render-gate runner
  render_summary.json       # last render pass results (written by render_and_verify.py)
  seed.py                   # Step 2: idempotent corpus ingestor
  seed_corpus.ipynb         # Primary human-facing artifact (runs all steps end-to-end)
  README.md                 # This file
```

## Current proof subset (all render-verified)

| Plugin | API | #examples | #verified | Videos path |
|--------|-----|-----------|-----------|-------------|
| manim-physics | Pendulum | 5 | 5 | renders/manim-physics/Pendulum/ |
| manim-chess | Board | 5 | 5 | renders/manim-chess/Board/ |
| manim-chemistry | BohrAtom | 5 | 5 | renders/manim-chemistry/BohrAtom/ |
| manim-dsa | MArray | 5 | 5 | renders/manim-dsa/MArray/ |
| manim-dsa | MStack | 2 | 2 | renders/manim-dsa/MStack/ |
| manim-ml | FeedForward | 5 | 5 | renders/manim-ml/FeedForward/ |
| manim-astronomy | Star | 5 | 5 | renders/manim-astronomy/Star/ |
| **TOTAL** | | **32** | **32** | |

## Example JSON schema

```json
{
  "api": "Pendulum",
  "plugin": "manim-physics",
  "scene_class": "PendulumSimple",
  "description": "Natural-language description embedded in the RAG corpus.",
  "code": "from manim import *\n...",
  "metadata": {
    "domain": "physics",
    "complexity": "beginner",
    "manimVersion": "0.19.2",
    "colorPalette": ["#FF862F"],
    "animationTypes": ["Create"],
    "apisUsed": ["Pendulum", "SpaceScene"],
    "category": "scenes",
    "tags": ["physics", "pendulum", "manim-physics"],
    "quality": 4,
    "source": "plugin_seed"
  },
  "verified": false   ← set to true by render_and_verify.py on success
}
```

## Step 1: Render-gate

Uses the hard-timeout wrapper at `_render_timeout.sh` with each plugin's `.venv`.

```bash
# Render all (idempotent — only re-renders failed examples):
python render_and_verify.py --only-unverified

# Force re-render one plugin:
python render_and_verify.py --plugin manim-physics

# Force re-render one API:
python render_and_verify.py --plugin manim-dsa --api MArray

# Override timeout (default: 60s; manim-ml: 120s):
python render_and_verify.py --plugin manim-ml --timeout 180
```

Output: updates `verified` field in each JSON in-place; saves mp4 to
`renders/<plugin>/<api>/<nn>.mp4`; writes `render_summary.json`.

## Step 2: Ingest

```bash
# Ingest all verified examples:
python seed.py --rag-url http://localhost:7001 --rag-key <key>

# Dry-run (no HTTP):
python seed.py --dry-run

# One plugin only:
python seed.py --plugin manim-ml --rag-url http://localhost:7001 --rag-key <key>
```

### Idempotency

- Stable ID per example: `plugin_seed_<plugin>_<api>_<nn>` (hyphens→underscores)
- Store uses `replaceOne({id: ...}, ..., {upsert: true})` — re-running overwrites, never duplicates.
- Only `verified=true` examples are sent.
- `metadata.source = "plugin_seed"` and `tags` include `plugin:<plugin>` on every doc.

## Step 3: Verify queryable

```bash
curl -s -X POST http://localhost:7001/enhance \
  -H "x-api-key: <key>" -H "Content-Type: application/json" \
  -d '{"prompt": "pendulum physics simulation plugin"}' | \
  python3 -c "import json,sys; d=json.load(sys.stdin); [print(s['id'],s['source']) for s in d['structuredContext']['similarScripts']]"
```

Note: Atlas vector search indexes take a few minutes to update after new documents
are upserted. If seeded docs don't appear immediately, wait 2–5 minutes and retry.

## How to add more examples

1. Create `examples/<plugin>/<api>/<nn>.json` following the schema above (`verified: false`).
2. Run `python render_and_verify.py --plugin <plugin> --api <api>`.
3. Run `python seed.py --plugin <plugin> --api <api> --rag-url ... --rag-key ...`.

To batch all APIs for a new plugin, author 5–10 JSON files per API endpoint, then:
```bash
python render_and_verify.py --plugin <plugin>
python seed.py --plugin <plugin> --rag-url ... --rag-key ...
```

## Running the full batch (all remaining APIs)

The proof subset covers one API per plugin. To seed the full corpus with all
plugin APIs:
1. Extract API list: `python /Users/vermarjun/Desktop/Manim\ plugins/_extract_api.py <plugin>`
2. Author 5–10 examples per API in `examples/<plugin>/<api>/`
3. Run `python render_and_verify.py --plugin <plugin>`
4. Run `python seed.py --plugin <plugin> --rag-url ... --rag-key ...`

## Plugin venvs

| Plugin | .venv path |
|--------|-----------|
| manim-physics | /Users/vermarjun/Desktop/Manim plugins/manim-physics/.venv |
| manim-chess | /Users/vermarjun/Desktop/Manim plugins/manim-chess/.venv |
| manim-chemistry | /Users/vermarjun/Desktop/Manim plugins/manim-chemistry/.venv |
| manim-dsa | /Users/vermarjun/Desktop/Manim plugins/manim-dsa/.venv |
| manim-ml | /Users/vermarjun/Desktop/Manim plugins/manim-ml/.venv |
| manim-astronomy | /Users/vermarjun/Desktop/Manim plugins/manim-astronomy/.venv |

Render timeout wrapper: `/Users/vermarjun/Desktop/Manim plugins/_render_timeout.sh`
Usage: `bash _render_timeout.sh <timeout_s> <venv_dir> <file.py> <SceneClass> [extra manim args]`
