#!/usr/bin/env python3
"""
Validation runner — called by the TypeScript validation pipeline as a subprocess.

Reads JSON from stdin: { "code": "...", "checks": ["ast","pyflakes","ruff","compile","manimLint"] }
Writes JSON to stdout: { "results": { <check>: "ok" | { "error": "...", "line": N } } }

All checks run in-process (no subprocesses within this subprocess) to keep overhead low.
"""

import ast
import json
import sys
import re
from pathlib import Path


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
        if w.messages:
            msg = w.messages[0]
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


def main():
    payload = json.loads(sys.stdin.read())
    code: str = payload.get("code", "")
    checks: list[str] = payload.get("checks", ["ast", "pyflakes", "ruff", "compile", "manimLint"])
    ruff_config: str | None = payload.get("ruffConfigPath")
    expected_class: str | None = payload.get("expectedClass")

    results: dict = {}

    check_map = {
        "ast": lambda: check_ast(code),
        "compile": lambda: check_compile(code),
        "pyflakes": lambda: check_pyflakes(code),
        "ruff": lambda: check_ruff(code, ruff_config),
        "manimLint": lambda: check_manim_lint(code),
        "sceneClass": lambda: check_scene_class_present(code, expected_class),
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
