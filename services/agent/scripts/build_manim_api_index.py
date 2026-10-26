#!/usr/bin/env python3
"""
Build manim_api_index.json by introspecting the installed Manim package.

Run at container build time:
    python scripts/build_manim_api_index.py --out src/assets/manim_api_index.json

The output is a flat JSON map: { "ClassName": { "signature", "doc", "module" } }
Used by manimApiCheck.ts for O(1) symbol lookup and by the validator's apiSurface check.
"""

import argparse
import inspect
import json
import sys
from pathlib import Path


def build_index() -> dict:
    try:
        import manim
    except ImportError:
        print("ERROR: manim is not installed. Run: pip install manim", file=sys.stderr)
        sys.exit(1)

    index = {}
    for name in dir(manim):
        if name.startswith("_"):
            continue
        obj = getattr(manim, name, None)
        if obj is None:
            continue
        if not (inspect.isclass(obj) or inspect.isfunction(obj)):
            continue
        try:
            sig = str(inspect.signature(obj)) if callable(obj) else None
        except (ValueError, TypeError):
            sig = None
        index[name] = {
            "signature": sig,
            "doc": (inspect.getdoc(obj) or "")[:500],  # truncate to keep file small
            "module": getattr(obj, "__module__", "manim"),
        }

    return index


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("src/assets/manim_api_index.json"),
    )
    args = parser.parse_args()

    index = build_index()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(index, indent=2))
    print(f"Wrote {len(index)} symbols to {args.out}")


if __name__ == "__main__":
    main()
