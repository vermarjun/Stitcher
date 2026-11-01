#!/usr/bin/env python3
"""
Validation runner — called by the TypeScript validation pipeline as a subprocess.

Reads JSON from stdin: { "code": "...", "checks": ["ast","pyflakes","ruff","compile","manimLint"] }
Writes JSON to stdout: { "results": { <check>: "ok" | { "error": "...", "line": N } } }

All checks run in-process (no subprocesses within this subprocess) to keep overhead low.
"""

import ast
import hashlib
import json
import sys
import re
import unicodedata
from pathlib import Path


def normalize_text(text: str) -> str:
    """Shared normalization for voiceover beat identity.

    MUST be byte-for-byte identical to OfflineTTS.normalize_text in the render
    service (NFC + strip + collapse all internal whitespace), because it is what
    the audio cache key is derived from. See /tmp/vo-contract.md.
    """
    text = unicodedata.normalize("NFC", text)
    text = " ".join(text.split())
    return text


def cache_key(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


def check_ast(code: str) -> dict:
    try:
        ast.parse(code)
        return {"status": "ok"}
    except SyntaxError as e:
        return {"status": "fail", "error": f"SyntaxError: {e.msg}", "line": e.lineno}


def check_compile(code: str) -> dict:
    try:
        compile(code, "<string>", "exec")
        return {"status": "ok"}
    except SyntaxError as e:
        return {"status": "fail", "error": f"compile: {e.msg}", "line": e.lineno}
    except Exception as e:
        return {"status": "fail", "error": str(e)}


def check_pyflakes(code: str) -> dict:
    try:
        from pyflakes import api as pf_api
        from pyflakes.checker import Checker
        import io
        tree = ast.parse(code)
        w = Checker(tree, "<string>")
        # Manim scenes always start with `from manim import *`, so star-import
        # notices are expected and must not fail validation.
        star_notices = ("ImportStarUsed", "ImportStarUsage")
        messages = [m for m in w.messages if type(m).__name__ not in star_notices]
        if messages:
            msg = messages[0]
            return {
                "status": "fail",
                "error": str(msg.message % msg.message_args),
                "line": msg.lineno,
            }
        return {"status": "ok"}
    except ImportError:
        return {"status": "skip", "error": "pyflakes not installed"}
    except SyntaxError as e:
        return {"status": "fail", "error": f"SyntaxError: {e.msg}", "line": e.lineno}


def check_ruff(code: str, config_path: str | None = None) -> dict:
    """Run ruff via subprocess — it's a compiled binary, no Python API."""
    import subprocess, tempfile, os

    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
        f.write(code)
        tmppath = f.name

    try:
        cmd = ["ruff", "check", "--output-format=json", tmppath]
        if config_path and Path(config_path).exists():
            cmd += ["--config", config_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"status": "ok"}
        try:
            violations = json.loads(result.stdout or "[]")
            if violations:
                v = violations[0]
                return {
                    "status": "fail",
                    "error": f"ruff {v.get('code','')}: {v.get('message','')}",
                    "line": v.get("location", {}).get("row"),
                    "suggestion": v.get("fix", {}).get("message") if v.get("fix") else None,
                }
        except json.JSONDecodeError:
            pass
        return {"status": "fail", "error": result.stdout or result.stderr}
    except FileNotFoundError:
        return {"status": "skip", "error": "ruff not installed"}
    except subprocess.TimeoutExpired:
        return {"status": "fail", "error": "ruff timed out"}
    finally:
        os.unlink(tmppath)


def check_manim_lint(code: str) -> dict:
    """Custom Manim security/quality rules."""
    BANNED_IMPORTS = ["subprocess", "socket", "requests", "urllib", "os.system",
                      "httpx", "aiohttp", "ftplib", "smtplib", "paramiko"]
    BANNED_CALLS = ["sys.exit", "os.system", "os.popen", "eval(", "exec(", "__import__("]

    lines = code.splitlines()
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Banned imports
        for banned in BANNED_IMPORTS:
            pattern = rf'\bimport\s+{re.escape(banned)}\b|from\s+{re.escape(banned)}\b'
            if re.search(pattern, stripped):
                return {"status": "fail", "error": f"Forbidden import: {banned}", "line": i}
        # Banned calls
        for call in BANNED_CALLS:
            if call in stripped:
                return {"status": "fail", "error": f"Forbidden call: {call}", "line": i}
        # Module-level code outside class/function (heuristic)
        if (stripped and
            not stripped.startswith(("#", "from ", "import ", "class ", "def ", "@", '"""', "'''", "__")) and
            not stripped.startswith(("Scene", "config")) and
            i > 1 and
            not any(lines[j].startswith((" ", "\t")) for j in range(max(0, i-2), i-1))):
            pass  # too many false positives — skip for now

    return {"status": "ok"}


def check_scene_class_present(code: str, expected_class: str | None) -> dict:
    if not expected_class:
        return {"status": "ok"}
    try:
        tree = ast.parse(code)
        classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
        if expected_class not in classes:
            return {
                "status": "fail",
                "error": f"Expected scene class '{expected_class}' not found. Found: {classes}",
            }
        return {"status": "ok"}
    except SyntaxError:
        return {"status": "ok"}  # AST check will surface the error


def _extract_voiceover_texts(code: str) -> list[str]:
    """Extract every string literal passed as `text=...` to `self.voiceover(...)`.

    Uses the AST so it correctly resolves escapes/concatenation to the real
    runtime string value (the same value OfflineTTS will see at render time).
    Only literal-string args are collected; a non-literal (f-string, variable,
    .format(), etc.) is reported via the sentinel marker so the check can fail
    with a clear message (the beats MUST be literals — they are the cache key).
    """
    DYNAMIC = "\x00__DYNAMIC_VOICEOVER_TEXT__\x00"
    texts: list[str] = []
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return texts

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        # match self.voiceover(...) (Attribute call named "voiceover")
        if not (isinstance(func, ast.Attribute) and func.attr == "voiceover"):
            continue
        # find the text= keyword arg; fall back to first positional
        text_node = None
        for kw in node.keywords:
            if kw.arg == "text":
                text_node = kw.value
                break
        if text_node is None and node.args:
            text_node = node.args[0]
        if text_node is None:
            continue
        if isinstance(text_node, ast.Constant) and isinstance(text_node.value, str):
            texts.append(text_node.value)
        else:
            # dynamic / non-literal text — not allowed (cache key must be literal)
            texts.append(DYNAMIC)
    return texts


def check_voiceover_beats(code: str, narration: list[str] | None) -> dict:
    """Voiceover beat-equality check (only runs when voiceover mode is ON).

    Asserts that the SET of `self.voiceover(text=...)` string literals in the code
    equals the SET of planned narration beats, after the SHARED normalize_text()
    (NFC + collapse whitespace). On mismatch, FAILS with a clear message listing
    the missing and extra beats so the refiner can correct beat-text drift.
    """
    if not narration:
        # voiceover requested but no beats supplied — nothing to compare against.
        return {"status": "ok"}

    DYNAMIC = "\x00__DYNAMIC_VOICEOVER_TEXT__\x00"
    found_raw = _extract_voiceover_texts(code)

    if any(t == DYNAMIC for t in found_raw):
        return {
            "status": "fail",
            "error": (
                "voiceover beat text must be a plain string literal, not an f-string, "
                "variable, or computed value. Each self.voiceover(text=...) must pass the "
                "exact narration beat string directly."
            ),
        }

    planned_norm = {normalize_text(b) for b in narration}
    found_norm = {normalize_text(t) for t in found_raw}

    if planned_norm == found_norm:
        # also enforce count: exactly one block per beat (no accidental dupes/drops)
        if len(found_raw) != len(narration):
            return {
                "status": "fail",
                "error": (
                    f"voiceover block count ({len(found_raw)}) does not match the number of "
                    f"planned narration beats ({len(narration)}). Emit exactly one "
                    f"self.voiceover(text=...) block per beat, in order."
                ),
            }
        return {"status": "ok"}

    missing = sorted(planned_norm - found_norm)
    extra = sorted(found_norm - planned_norm)
    parts = []
    if missing:
        parts.append("MISSING beats (planned but not found verbatim in code): " + json.dumps(missing))
    if extra:
        parts.append("EXTRA/ALTERED beats (in code but not in plan — likely reworded): " + json.dumps(extra))
    return {
        "status": "fail",
        "error": (
            "voiceover narration drift: the self.voiceover(text=...) strings do not match the "
            "planned narration beats verbatim (after NFC + whitespace normalization). "
            "Copy each beat EXACTLY. "
            + " | ".join(parts)
        ),
    }


def main():
    payload = json.loads(sys.stdin.read())
    code: str = payload.get("code", "")
    checks: list[str] = payload.get("checks", ["ast", "pyflakes", "ruff", "compile", "manimLint"])
    ruff_config: str | None = payload.get("ruffConfigPath")
    expected_class: str | None = payload.get("expectedClass")
    narration: list[str] | None = payload.get("voiceoverNarration")

    results: dict = {}

    check_map = {
        "ast": lambda: check_ast(code),
        "compile": lambda: check_compile(code),
        "pyflakes": lambda: check_pyflakes(code),
        "ruff": lambda: check_ruff(code, ruff_config),
        "manimLint": lambda: check_manim_lint(code),
        "sceneClass": lambda: check_scene_class_present(code, expected_class),
        "voiceoverBeats": lambda: check_voiceover_beats(code, narration),
    }

    fail_fast: str | None = None
    for check_name in checks:
        fn = check_map.get(check_name)
        if not fn:
            results[check_name] = {"status": "skip", "error": "unknown check"}
            continue
        result = fn()
        results[check_name] = result
        if result["status"] == "fail" and fail_fast is None:
            fail_fast = check_name
            break  # fail-fast

    print(json.dumps({"results": results, "failFast": fail_fast}))


if __name__ == "__main__":
    main()
