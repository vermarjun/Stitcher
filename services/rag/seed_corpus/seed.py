#!/usr/bin/env python3
"""
seed.py — Idempotent ingestion of rich plugin examples into the RAG corpus.

Strategy (v2, updated 2026-05-31):
  - Loads all seed_corpus/examples_v2/<plugin>.json (one flat file per plugin).
  - Each example carries its own stable `id` field — used as the corpus doc id.
  - Maps the rich v2 schema to the container's /corpus/add envelope:
      { id, metadata: {...}, parent: { code, sceneClassName } }
  - POSTs to POST /corpus/add in batches.
  - Upsert is idempotent: the container skips docs with existing IDs unless
    --force is passed (not yet wired to the API; use --purge-old to reset).

DEPRECATED: seed_corpus/examples/<plugin>/<api>/<nn>.json (thin one-liners).
  These 32 thin docs were purged from the corpus on 2026-05-31.
  The examples/ directory is retained for reference only — do NOT re-ingest it.

Usage:
    python seed.py                         # ingest all v2 examples
    python seed.py --plugin manim-dsa      # only one plugin
    python seed.py --dry-run               # print what would be sent, no HTTP

Callable as a function too:
    from seed_corpus.seed import ingest_v2_examples
    ingest_v2_examples(plugin="manim-dsa")
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed — run: pip install requests")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

SEED_DIR = Path(__file__).parent.resolve()
EXAMPLES_V2_DIR = SEED_DIR / "examples_v2"

# DEPRECATED — kept for reference, never re-ingest
EXAMPLES_DIR_LEGACY = SEED_DIR / "examples"

RAG_BASE_URL = os.environ.get("RAG_BASE_URL", "http://localhost:7001")
RAG_API_KEY = os.environ.get("RAG_API_KEY", "change_me_rag_api_key")
BATCH_SIZE = int(os.environ.get("SEED_BATCH_SIZE", "3"))

# All supported plugins (v2 files)
ALL_PLUGINS = [
    "manim-astronomy",
    "manim-chemistry",
    "manim-chess",
    "manim-dsa",
    "manim-ml",
    "manim-physics",
]


# ─── Document builder ────────────────────────────────────────────────────────

def v2_example_to_corpus_doc(ex: dict) -> dict:
    """
    Convert a v2 example JSON to the /corpus/add document envelope.

    The container expects:
      {
        "id": <str>,
        "metadata": { originalPrompt, description, sourceType, domain,
                      tags, complexity, quality, colorPalette, manimVersion },
        "parent": { code, sceneClassName }
      }
    """
    return {
        "id": ex["id"],
        "metadata": {
            "originalPrompt": ex.get("originalPrompt", ""),
            "description": ex.get("description", ""),
            "sourceType": ex.get("sourceType", "plugin_seed"),
            "domain": ex.get("domain", "general"),
            "tags": ex.get("tags", []),
            "complexity": ex.get("complexity", "intermediate"),
            "quality": ex.get("quality", 4),
            "colorPalette": ex.get("colorPalette", []),
            "manimVersion": ex.get("manimVersion", "0.19.2"),
        },
        "parent": {
            "code": ex.get("code", ""),
            "sceneClassName": ex.get("sceneClassName", "Scene"),
        },
    }


# ─── Corpus loader ────────────────────────────────────────────────────────────

def load_v2_examples(plugin_filter: str | None = None) -> list[dict]:
    """
    Load all examples from examples_v2/<plugin>.json files.
    Returns list of raw example dicts.
    """
    plugins = [plugin_filter] if plugin_filter else ALL_PLUGINS
    out = []
    for plugin in plugins:
        path = EXAMPLES_V2_DIR / f"{plugin}.json"
        if not path.exists():
            print(f"  [WARN] No examples_v2 file for plugin: {plugin}")
            continue
        with open(path) as f:
            data = json.load(f)
        if not isinstance(data, list):
            print(f"  [WARN] {plugin}.json is not a list — skipping")
            continue
        print(f"  {plugin}: {len(data)} examples")
        out.extend(data)
    return out


# ─── Ingestion ────────────────────────────────────────────────────────────────

def post_batch(documents: list[dict], dry_run: bool) -> dict:
    """POST /corpus/add with a batch of documents. Returns the response JSON."""
    if dry_run:
        print(f"  [DRY-RUN] Would POST {len(documents)} doc(s):")
        for d in documents:
            print(f"    id={d['id']}")
        return {"dry_run": True, "count": len(documents)}

    resp = requests.post(
        f"{RAG_BASE_URL}/corpus/add",
        headers={"x-api-key": RAG_API_KEY, "Content-Type": "application/json"},
        json={"documents": documents},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def ingest_v2_examples(
    plugin_filter: str | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Load all v2 examples and upsert them into the corpus.
    Returns a summary dict.
    """
    print(f"Loading examples from: {EXAMPLES_V2_DIR}")
    examples = load_v2_examples(plugin_filter)
    if not examples:
        print("No v2 examples found matching the filter.")
        return {"total": 0, "stored": 0, "skipped": 0, "batches": 0}

    print(f"\nFound {len(examples)} example(s) to ingest.\n")

    docs = [v2_example_to_corpus_doc(ex) for ex in examples]

    total_stored = 0
    total_skipped = 0
    batches = 0

    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i : i + BATCH_SIZE]
        print(f"Batch {batches + 1} ({len(batch)} doc(s))...")
        resp = post_batch(batch, dry_run)
        if not dry_run:
            results = resp.get("results", [])
            stored = sum(1 for r in results if r.get("stored"))
            skipped = sum(1 for r in results if r.get("skipped"))
            for r in results:
                status = "STORED" if r.get("stored") else f"SKIP:{r.get('skipReason', '?')}"
                print(f"  [{status}] {r['id']}")
            total_stored += stored
            total_skipped += skipped
        batches += 1

    summary = {
        "total": len(docs),
        "stored": total_stored if not dry_run else 0,
        "skipped": total_skipped if not dry_run else 0,
        "batches": batches,
        "dry_run": dry_run,
    }
    print(f"\nIngestion complete: {summary}")
    return summary


# ─── Legacy shim (do NOT call for ingestion) ─────────────────────────────────

def ingest_verified_examples(*args, **kwargs):
    """
    DEPRECATED. Previously ingested thin one-liner examples from examples/.
    The 32 thin docs were purged on 2026-05-31.
    Call ingest_v2_examples() instead.
    """
    raise RuntimeError(
        "ingest_verified_examples() is DEPRECATED. "
        "The thin examples/ set was purged. Call ingest_v2_examples() instead."
    )


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    global RAG_BASE_URL, RAG_API_KEY

    parser = argparse.ArgumentParser(
        description="Ingest rich v2 plugin examples into RAG corpus (idempotent)"
    )
    parser.add_argument("--plugin", help="Filter to one plugin (e.g. manim-dsa)")
    parser.add_argument("--dry-run", action="store_true", help="Print docs without posting")
    parser.add_argument("--rag-url", default=RAG_BASE_URL, help="RAG service base URL")
    parser.add_argument("--rag-key", default=RAG_API_KEY, help="RAG API key")
    args = parser.parse_args()

    RAG_BASE_URL = args.rag_url
    RAG_API_KEY = args.rag_key

    ingest_v2_examples(
        plugin_filter=args.plugin,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
