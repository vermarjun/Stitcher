#!/usr/bin/env python3
"""
render_and_verify.py — Render-gate runner for plugin seed examples.

For each example JSON in seed_corpus/examples/<plugin>/<api>/<nn>.json:
  1. Writes a temp .py file containing the scene code.
  2. Renders it via the plugin's .venv using the hard-timeout wrapper.
  3. On EXIT=0: copies the mp4 to seed_corpus/renders/<plugin>/<api>/<nn>.mp4
     and marks the JSON as verified=true.
  4. On failure: marks verified=false and logs the failure.

Usage:
    python render_and_verify.py                  # all examples
    python render_and_verify.py --plugin manim-dsa
    python render_and_verify.py --plugin manim-dsa --api MArray
    python render_and_verify.py --only-unverified  # skip already-verified
    python render_and_verify.py --timeout 60       # per-render timeout (s)
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

SEED_DIR = Path(__file__).parent.resolve()
EXAMPLES_DIR = SEED_DIR / "examples"
RENDERS_DIR = SEED_DIR / "renders"
PLUGINS_ROOT = Path("/Users/vermarjun/Desktop/Manim plugins")
TIMEOUT_SCRIPT = PLUGINS_ROOT / "_render_timeout.sh"

PLUGIN_TIMEOUTS = {
    "manim-ml": 120,  # ML renders are slow
    "default": 60,
}

# ─── Helpers ──────────────────────────────────────────────────────────────────


def get_timeout(plugin: str, override: int | None) -> int:
    if override is not None:
        return override
    return PLUGIN_TIMEOUTS.get(plugin, PLUGIN_TIMEOUTS["default"])


def find_produced_mp4(scene_class: str, tmp_dir: Path) -> Path | None:
    """Search for a manim-produced mp4 under the tmpdir media output."""
    pattern = str(tmp_dir / "media" / "videos" / "**" / "*.mp4")
    hits = glob.glob(pattern, recursive=True)
    if not hits:
        return None
    # Prefer the file that contains the scene_class name (case-insensitive)
    for h in hits:
        if scene_class.lower() in Path(h).stem.lower():
            return Path(h)
    return Path(hits[0])


def render_example(
    example_json: Path,
    timeout_s: int,
    only_unverified: bool,
) -> dict:
    """Render a single example. Returns a result dict."""
    with open(example_json) as f:
        ex = json.load(f)

    plugin = ex["plugin"]
    api = ex["api"]
    scene_class = ex["scene_class"]
    code = ex["code"]
    nn = example_json.stem  # e.g. "01"

    result = {
        "file": str(example_json),
        "plugin": plugin,
        "api": api,
        "scene": scene_class,
        "nn": nn,
        "verified": ex.get("verified", False),
        "skipped": False,
        "mp4": None,
        "error": None,
    }

    if only_unverified and ex.get("verified") is True:
        result["skipped"] = True
        return result

    venv_dir = PLUGINS_ROOT / plugin / ".venv"
    if not venv_dir.exists():
        result["error"] = f"venv not found: {venv_dir}"
        return result

    render_out_dir = RENDERS_DIR / plugin / api
    render_out_dir.mkdir(parents=True, exist_ok=True)
    dest_mp4 = render_out_dir / f"{nn}.mp4"

    # Write temp scene file
    with tempfile.TemporaryDirectory(prefix=f"manimrag_{plugin}_{scene_class}_") as tmp:
        tmp_path = Path(tmp)
        scene_file = tmp_path / "scene.py"
        scene_file.write_text(code)

        cmd = [
            "bash",
            str(TIMEOUT_SCRIPT),
            str(timeout_s),
            str(venv_dir),
            str(scene_file),
            scene_class,
            "--media_dir",
            str(tmp_path / "media"),
        ]

        print(f"  Rendering {plugin}/{api}/{nn}.json ({scene_class}) [timeout={timeout_s}s]...")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        stdout = proc.stdout + proc.stderr

        # Parse EXIT= line from the wrapper
        exit_match = re.search(r"EXIT=(\d+)", stdout)
        timed_out = "TIMEOUT after" in stdout

        if timed_out:
            result["error"] = f"TIMEOUT after {timeout_s}s"
            _write_verified(example_json, False)
            return result

        exit_code = int(exit_match.group(1)) if exit_match else proc.returncode

        if exit_code == 0:
            mp4 = find_produced_mp4(scene_class, tmp_path)
            if mp4 and mp4.exists():
                shutil.copy2(mp4, dest_mp4)
                result["verified"] = True
                result["mp4"] = str(dest_mp4)
                _write_verified(example_json, True)
                print(f"    OK — {dest_mp4.name}")
            else:
                result["error"] = "EXIT=0 but no mp4 found"
                _write_verified(example_json, False)
        else:
            # Capture last lines of output for error message
            last_lines = "\n".join(stdout.strip().splitlines()[-8:])
            result["error"] = f"exit={exit_code}\n{last_lines}"
            _write_verified(example_json, False)

    return result


def _write_verified(json_path: Path, value: bool) -> None:
    """Update the verified field in-place."""
    with open(json_path) as f:
        data = json.load(f)
    data["verified"] = value
    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ─── Main ──────────────────────────────────────────────────────────────────────


def collect_examples(plugin_filter: str | None, api_filter: str | None) -> list[Path]:
    pattern = str(EXAMPLES_DIR / "**" / "*.json")
    all_files = sorted(glob.glob(pattern, recursive=True))
    results = []
    for f in all_files:
        p = Path(f)
        parts = p.relative_to(EXAMPLES_DIR).parts
        if len(parts) < 3:
            continue
        ex_plugin, ex_api = parts[0], parts[1]
        if plugin_filter and ex_plugin != plugin_filter:
            continue
        if api_filter and ex_api != api_filter:
            continue
        results.append(p)
    return results


def main():
    parser = argparse.ArgumentParser(description="Render-gate runner for plugin seed examples")
    parser.add_argument("--plugin", help="Filter to a specific plugin (e.g. manim-dsa)")
    parser.add_argument("--api", help="Filter to a specific API (e.g. MArray)")
    parser.add_argument("--timeout", type=int, default=None, help="Per-render timeout in seconds")
    parser.add_argument("--only-unverified", action="store_true", help="Skip already-verified examples")
    args = parser.parse_args()

    examples = collect_examples(args.plugin, args.api)
    if not examples:
        print(f"No examples found (plugin={args.plugin}, api={args.api})")
        sys.exit(0)

    print(f"Found {len(examples)} example(s) to process.\n")

    results = []
    for ex_file in examples:
        parts = ex_file.relative_to(EXAMPLES_DIR).parts
        plugin = parts[0]
        timeout = get_timeout(plugin, args.timeout)
        r = render_example(ex_file, timeout, args.only_unverified)
        results.append(r)

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("RENDER SUMMARY")
    print("=" * 60)
    ok = [r for r in results if r["verified"] and not r["skipped"]]
    fail = [r for r in results if not r["verified"] and not r["skipped"] and r["error"]]
    skipped = [r for r in results if r["skipped"]]

    for r in ok:
        print(f"  PASS  {r['plugin']}/{r['api']}/{r['nn']} → {r['mp4']}")
    for r in fail:
        first_line = (r["error"] or "").splitlines()[0]
        print(f"  FAIL  {r['plugin']}/{r['api']}/{r['nn']}  ({first_line})")
    for r in skipped:
        print(f"  SKIP  {r['plugin']}/{r['api']}/{r['nn']}  (already verified)")

    print(f"\nTotal: {len(results)} | Pass: {len(ok)} | Fail: {len(fail)} | Skip: {len(skipped)}")

    # Write a summary JSON
    summary_path = SEED_DIR / "render_summary.json"
    with open(summary_path, "w") as f:
        json.dump({"results": results, "totals": {"total": len(results), "pass": len(ok), "fail": len(fail), "skip": len(skipped)}}, f, indent=2)
    print(f"\nFull summary written to: {summary_path}")


if __name__ == "__main__":
    main()
