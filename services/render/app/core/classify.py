"""Turn Manim's stderr sludge into a structured, actionable error.

Manim error output is long, repetitive, and mixes useful info (the actual exception,
the line number in the user's code) with noise (import-time logging, deprecation warnings,
the whole ffmpeg invocation it was about to run). Agents and frontends need the useful
bits surfaced — this module picks them out and assigns a coarse category.

Categories map 1:1 to actions a caller might take:
  - SyntaxError            — can't even import; show the line, don't retry
  - NameError              — typo or unknown manim symbol; show line, show name
  - TypeError/ValueError   — wrong arg to a Mobject; show line + the bad call
  - LaTeXError             — MathTex failed; check LaTeX install or escape the string
  - ImportError            — user tried to import something we don't ship
  - Timeout / OOM          — filled in by the sandbox layer, not by parsing stderr
  - Unknown                — we gave up; return full stderr and let a human look
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import FailurePhase

# Regex patterns in priority order — first match wins. Anchored loosely because Manim's
# formatting drifts release to release; we match the exception name, not the surrounding
# punctuation.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("SyntaxError",       re.compile(r"(?m)^\s*(?:File .+, line (\d+).*\n)?.*SyntaxError: (.+)$")),
    ("IndentationError",  re.compile(r"(?m)^.*IndentationError: (.+)$")),
    ("NameError",         re.compile(r"(?m)^.*NameError: (.+)$")),
    ("AttributeError",    re.compile(r"(?m)^.*AttributeError: (.+)$")),
    ("TypeError",         re.compile(r"(?m)^.*TypeError: (.+)$")),
    ("ValueError",        re.compile(r"(?m)^.*ValueError: (.+)$")),
    ("LaTeXError",        re.compile(r"(?mi)LaTeX\s+compilation.*failed|!\s*LaTeX Error:\s*(.+)|^\s*latex error")),
    ("ImportError",       re.compile(r"(?m)^.*(?:ImportError|ModuleNotFoundError): (.+)$")),
]

_LINE_RE = re.compile(r'File "[^"]*animation\.py", line (\d+)')


@dataclass(frozen=True)
class ClassifiedError:
    phase: FailurePhase
    category: str
    summary: str
    line: int | None


def classify(stderr: str, stdout: str = "") -> ClassifiedError:
    combined = stderr + "\n" + stdout

    # Line number in the user's file, if any. Preferred over per-pattern line capture —
    # the traceback consistently names animation.py and the final frame is the one the user
    # cares about.
    line_matches = _LINE_RE.findall(combined)
    line = int(line_matches[-1]) if line_matches else None

    for category, pattern in _PATTERNS:
        m = pattern.search(combined)
        if not m:
            continue
        # Grab the last group that's actually populated; different patterns use different
        # group counts and we don't want to special-case each one.
        message = next((g for g in reversed(m.groups() or ()) if g), category)
        return ClassifiedError(
            phase="manim_execution",
            category=category,
            summary=message.strip()[:500],
            line=line,
        )

    # Nothing matched. Return the last non-empty stderr line as the summary — it's almost
    # always the exception line, and better than an empty string.
    tail = next((ln for ln in reversed(stderr.splitlines()) if ln.strip()), "")
    return ClassifiedError(
        phase="manim_execution",
        category="Unknown",
        summary=(tail or "manim exited non-zero with no stderr")[:500],
        line=line,
    )
