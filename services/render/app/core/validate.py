"""Cheap AST pre-guard run BEFORE we pay for a sandbox.

The sandbox is the real defence — this module exists to reject obviously-malicious input
without spinning up bwrap, not to provide security. A motivated attacker can bypass AST
analysis trivially (string-built imports, `getattr` chains, `__import__`); we rely on
bubblewrap + seccomp for that.

What this catches:
  - `import os; os.system(...)` — no reason a Manim scene needs subprocess
  - `open('/etc/passwd')` — or other absolute paths outside /work
  - `__import__('socket')` — network attempts that don't need bwrap to reject
  - syntax errors — return a helpful pointer instead of stderr sludge

What we DO allow:
  - `from manim import *` and its whole public surface
  - `import numpy`, `import math`, `import random`, `import itertools`
  - `import scipy`, `import sympy` (common in educational Manim work)

The allowlist is intentionally permissive. Tightening it rejects legitimate scenes; we'd
rather let the sandbox catch abuse than false-reject a grad student's trig demo.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass

ALLOWED_TOP_LEVEL_IMPORTS: frozenset[str] = frozenset({
    "manim", "numpy", "np", "math", "random", "itertools", "functools", "collections",
    "dataclasses", "typing", "enum", "fractions", "decimal", "statistics",
    "scipy", "sympy", "colour", "PIL",
    # Native voiceover: `from manim_voiceover import VoiceoverScene` and
    # `from stitcher_voiceover import OfflineTTS`. Both are baked into the image at
    # build time and make NO network calls at render time (OfflineTTS reads local
    # cached mp3s only). The `VoiceoverScene` base class is a plain Name reference,
    # already permitted by the guard.
    "manim_voiceover", "stitcher_voiceover",
    # Vendored Manim plugins (patched + installed at build time — see vendor/).
    "manim_chess", "manim_physics", "manim_chemistry",
    "manim_ml", "manim_dsa", "manim_Astronomy",
    # Extra deps pulled in by plugins (networkx for DSA, PIL/Pillow for ML).
    "networkx", "pymunk", "shapely", "pandas", "xmltodict",
    "__future__",
})

BANNED_NAMES: frozenset[str] = frozenset({
    "eval", "exec", "compile", "__import__", "open",
    "globals", "locals", "vars",
    "breakpoint", "input",
})

BANNED_ATTRIBUTES: frozenset[str] = frozenset({
    "system", "popen", "spawn", "spawnl", "spawnv",
    "fork", "forkpty", "execv", "execve", "execvp",
    "load_module",
})

# Plugin constructs that are broken/unsafe IN THIS render environment — a
# RELIABILITY guard, not a security one. Rejected fast so the job falls back to a
# title card instead of hanging a render slot or crash-looping the debugger:
#   - manim_chemistry molecule_from_pubchem / *_from_pubchem → live PubChem HTTP
#     with NO timeout; with the sandbox off (network open) it can tie up a render
#     slot for the full wall-clock timeout.
#   - manim_chemistry file-based constructors (from_*_file) → the CSV/.mol/.sdf
#     data files are not packaged in the wheel → FileNotFoundError every time.
#   - ThreeDMolecule / PeriodicTable → require an OpenGL context (headless = fail)
#     or a data file that isn't installed.
UNSUPPORTED_PLUGIN_CALLS: frozenset[str] = frozenset({
    "molecule_from_pubchem", "from_pubchem",
    "from_mol_file", "from_sdf_file", "from_csv_file", "from_pdb_file",
})
UNSUPPORTED_PLUGIN_NAMES: frozenset[str] = frozenset({
    "ThreeDMolecule", "PeriodicTable",
})


@dataclass(frozen=True)
class ValidationIssue:
    line: int
    summary: str


def validate(code: str) -> list[ValidationIssue]:
    """Return a list of issues. Empty list = looks safe to hand to the sandbox."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [ValidationIssue(line=e.lineno or 0, summary=f"SyntaxError: {e.msg}")]

    issues: list[ValidationIssue] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in ALLOWED_TOP_LEVEL_IMPORTS:
                    issues.append(ValidationIssue(
                        node.lineno, f"import of '{alias.name}' is not permitted"
                    ))
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root and root not in ALLOWED_TOP_LEVEL_IMPORTS:
                issues.append(ValidationIssue(
                    node.lineno, f"import from '{node.module}' is not permitted"
                ))
        elif isinstance(node, ast.Call):
            callee = node.func
            if isinstance(callee, ast.Name) and callee.id in BANNED_NAMES:
                issues.append(ValidationIssue(
                    node.lineno, f"call to '{callee.id}' is not permitted"
                ))
            elif isinstance(callee, ast.Attribute) and callee.attr in BANNED_ATTRIBUTES:
                issues.append(ValidationIssue(
                    node.lineno, f"call to '*.{callee.attr}' is not permitted"
                ))
            elif isinstance(callee, ast.Name) and callee.id in UNSUPPORTED_PLUGIN_NAMES:
                issues.append(ValidationIssue(
                    node.lineno,
                    f"'{callee.id}' is not supported in this renderer (OpenGL/data-file dependency) — use a 2D Cairo-safe alternative",
                ))
            elif isinstance(callee, ast.Attribute) and callee.attr in UNSUPPORTED_PLUGIN_CALLS:
                issues.append(ValidationIssue(
                    node.lineno,
                    f"'.{callee.attr}(...)' is not supported in this renderer (network/data-file dependency) — build the molecule from inline data instead",
                ))
        elif (
            isinstance(node, ast.Attribute)
            and node.attr.startswith("__") and node.attr.endswith("__")
            and node.attr not in {"__init__", "__name__", "__file__", "__doc__", "__main__"}
        ):
            # Dunder attribute access is a classic escape vector (__class__.__bases__...).
            issues.append(ValidationIssue(
                node.lineno, f"dunder attribute access '.{node.attr}' is not permitted"
            ))

    return issues


def first_issue_as_error(issues: list[ValidationIssue]) -> tuple[int | None, str] | None:
    """Convenience shape for the pipeline's error response."""
    if not issues:
        return None
    i = issues[0]
    trailing = "" if len(issues) == 1 else f" (+{len(issues) - 1} more)"
    return i.line or None, f"{i.summary}{trailing}"
