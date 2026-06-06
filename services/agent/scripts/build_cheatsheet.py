#!/usr/bin/env python3
"""
Build manim_cheatsheet.json — unified API cheat sheet for Manim core + 6 plugins.

Merges:
  - src/assets/manim_api_index.json (manim core, 403 symbols)
  - /Users/vermarjun/Desktop/Manim plugins/<plugin>/api_index.json (6 plugins)
  - extracts minimal usage snippets from each plugin's smoke_tests.py

Output: src/assets/manim_cheatsheet.json
Each entry: { name, source, import, signature, kind, bases, description, example }

Run:
    python scripts/build_cheatsheet.py [--out src/assets/manim_cheatsheet.json]
    # or using the plugin venv:
    /Users/vermarjun/Desktop/Manim\ plugins/manim-dsa/.venv/bin/python scripts/build_cheatsheet.py
"""

import argparse
import ast
import inspect
import json
import re
import sys
import textwrap
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
PLUGINS_ROOT = Path("/Users/vermarjun/Desktop/Manim plugins")

CORE_INDEX = REPO_ROOT / "src" / "assets" / "manim_api_index.json"

PLUGIN_META: dict[str, dict] = {
    "manim-astronomy": {
        "import": "from manim_Astronomy import *",
        "dir": PLUGINS_ROOT / "manim-astronomy",
    },
    "manim-chemistry": {
        "import": "from manim_chemistry import *",
        "dir": PLUGINS_ROOT / "manim-chemistry",
    },
    "manim-chess": {
        "import": "from manim_chess import *",
        "dir": PLUGINS_ROOT / "manim-chess",
    },
    "manim-dsa": {
        "import": "from manim_dsa import *",
        "dir": PLUGINS_ROOT / "manim-dsa",
    },
    "manim-ml": {
        "import": "from manim_ml.neural_network import NeuralNetwork, FeedForwardLayer, Convolutional2DLayer, ImageLayer, MaxPooling2DLayer, EmbeddingLayer, VectorLayer, MathOperationLayer",
        "dir": PLUGINS_ROOT / "manim-ml",
    },
    "manim-physics": {
        "import": "from manim_physics import *",
        "dir": PLUGINS_ROOT / "manim-physics",
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def condense_doc(doc: str | None) -> str:
    """Return a one-line description from a docstring."""
    if not doc:
        return ""
    # Strip reStructuredText / NumPy-style param sections
    lines = doc.strip().splitlines()
    # Grab the first non-empty line(s) before any param-block header
    summary_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        # Stop at param section headers
        if stripped.lower() in ("parameters", "returns", "attributes", "examples",
                                 "notes", "see also", "raises", "tip"):
            break
        if stripped.startswith("----------") or stripped.startswith(".."):
            break
        if stripped:
            summary_lines.append(stripped)
        elif summary_lines:
            # First blank line after text → end of summary paragraph
            break
    result = " ".join(summary_lines)
    # Truncate if still too long
    if len(result) > 120:
        result = result[:117].rstrip() + "..."
    return result or doc.strip().splitlines()[0][:120]


def clean_signature(sig: str | None) -> str:
    """Strip 'self, ' prefix and shorten default object reprs."""
    if not sig:
        return "()"
    # Remove ugly default object reprs like <manim_dsa.constants... at 0x...>
    sig = re.sub(r"<[^>]{0,120}>", "...", sig)
    # Remove leading 'self, '
    sig = re.sub(r"^\(self,\s*", "(", sig)
    sig = re.sub(r"^\(self\)", "()", sig)
    # Trim very long signatures to keep things readable
    if len(sig) > 200:
        sig = sig[:197] + "..."
    return sig


# ── Smoke-test snippet extraction ────────────────────────────────────────────

class SnippetVisitor(ast.NodeVisitor):
    """Walk a smoke_tests.py AST and collect per-symbol snippets.

    For each class body (a Scene subclass), record which top-level names
    are referenced, then store the 'construct' body lines as a snippet for
    each referenced name.
    """

    def __init__(self, source: str):
        self.source = source
        self.lines = source.splitlines()
        self.snippets: dict[str, list[str]] = {}  # symbol -> [snippet, ...]

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        # Find the construct method
        construct: ast.FunctionDef | None = None
        for item in node.body:
            if isinstance(item, ast.FunctionDef) and item.name == "construct":
                construct = item
                break
        if construct is None:
            self.generic_visit(node)
            return

        # Extract source lines of construct body (skip `def construct(self):`)
        body_start = construct.body[0].lineno - 1
        body_end = construct.body[-1].end_lineno  # type: ignore[attr-defined]
        body_lines = self.lines[body_start:body_end]
        # Dedent
        snippet = textwrap.dedent("\n".join(body_lines)).strip()
        # Limit to 8 lines
        snippet_lines = snippet.splitlines()
        if len(snippet_lines) > 8:
            snippet = "\n".join(snippet_lines[:8]) + "\n    # ..."

        # Collect all Name nodes in the construct body to find which symbols
        # from the plugin this scene uses
        names: set[str] = set()
        for child in ast.walk(construct):
            if isinstance(child, ast.Name):
                names.add(child.id)
            elif isinstance(child, ast.Attribute):
                names.add(child.attr)

        for name in names:
            self.snippets.setdefault(name, []).append(snippet)

        self.generic_visit(node)


def extract_snippets(smoke_path: Path) -> dict[str, str]:
    """Return {symbol: best_snippet} from a smoke_tests.py file."""
    if not smoke_path.exists():
        return {}
    try:
        source = smoke_path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        visitor = SnippetVisitor(source)
        visitor.visit(tree)
        # Pick the shortest snippet (most focused) for each symbol
        return {k: min(v, key=len) for k, v in visitor.snippets.items()}
    except SyntaxError:
        return {}


# ── Core import line derivation ──────────────────────────────────────────────

def core_import(module: str) -> str:
    """Return a specific import line for a core manim symbol."""
    # Most things are available via `from manim import *`
    # Provide the canonical top-level import.
    return "from manim import *"


# ── Main build logic ─────────────────────────────────────────────────────────

def build_cheatsheet() -> dict[str, dict]:
    cheatsheet: dict[str, dict] = {}

    # 1. Core manim symbols
    print(f"Loading core index from {CORE_INDEX}...")
    core_index = json.loads(CORE_INDEX.read_text())
    core_count = 0
    for name, entry in core_index.items():
        sig = clean_signature(entry.get("signature"))
        doc = condense_doc(entry.get("doc"))
        module = entry.get("module", "manim")

        # Simple canonical 1-2 line example for core manim
        # Pick a sensible representative example based on kind
        example = _core_example(name, sig)

        cheatsheet[name] = {
            "name": name,
            "source": "manim",
            "import": core_import(module),
            "signature": sig,
            "kind": "class" if _looks_like_class(name, sig) else "function",
            "bases": [],  # not in core index
            "description": doc,
            "example": example,
        }
        core_count += 1

    print(f"  → {core_count} core symbols loaded")

    # 2. Plugin symbols
    for plugin_name, meta in PLUGIN_META.items():
        plugin_dir: Path = meta["dir"]
        api_index_path = plugin_dir / "api_index.json"
        smoke_path = plugin_dir / "smoke_tests.py"

        if not api_index_path.exists():
            print(f"  WARN: {api_index_path} not found — skipping {plugin_name}", file=sys.stderr)
            continue

        plugin_index = json.loads(api_index_path.read_text())
        snippets = extract_snippets(smoke_path)
        count = 0

        for name, entry in plugin_index.items():
            sig = clean_signature(entry.get("signature"))
            doc = condense_doc(entry.get("doc"))
            kind = entry.get("kind", "class")
            bases = entry.get("bases", [])

            # Try to get snippet from smoke tests; fall back to generic
            raw_snippet = snippets.get(name, "")
            if not raw_snippet:
                # Minimal synthetic snippet
                raw_snippet = f"obj = {name}()\nself.add(obj)\nself.wait(0.5)"

            cheatsheet[name] = {
                "name": name,
                "source": plugin_name,
                "import": meta["import"],
                "signature": sig,
                "kind": kind,
                "bases": bases,
                "description": doc,
                "example": raw_snippet,
            }
            count += 1

        print(f"  → {count} symbols from {plugin_name}")

    return cheatsheet


def _looks_like_class(name: str, sig: str) -> bool:
    """Heuristic: PascalCase names are likely classes."""
    return bool(re.match(r"^[A-Z][a-zA-Z0-9]+$", name))


def _core_example(name: str, sig: str) -> str:
    """Return a minimal 1-2 line canonical usage for well-known core symbols."""
    # Hand-crafted examples for the most-used symbols
    known: dict[str, str] = {
        "Scene": "class MyScene(Scene):\n    def construct(self):\n        self.play(Create(Square()))",
        "ThreeDScene": "class My3D(ThreeDScene):\n    def construct(self):\n        self.set_camera_orientation(phi=70*DEGREES)\n        self.add(Sphere())",
        "MathTex": "eq = MathTex(r'E = mc^2')\nself.play(Write(eq))",
        "Tex": "t = Tex(r'Hello \\LaTeX')\nself.play(FadeIn(t))",
        "Text": "t = Text('Hello', font_size=48)\nself.play(Write(t))",
        "Create": "self.play(Create(Square()))",
        "Write": "self.play(Write(MathTex(r'f(x)')))",
        "FadeIn": "self.play(FadeIn(Square()))",
        "FadeOut": "self.play(FadeOut(square))",
        "Transform": "self.play(Transform(sq, Circle()))",
        "ReplacementTransform": "self.play(ReplacementTransform(sq, Circle()))",
        "Axes": "ax = Axes(x_range=[-3,3], y_range=[-2,2])\nself.add(ax)",
        "NumberPlane": "plane = NumberPlane()\nself.add(plane)",
        "Circle": "c = Circle(radius=1, color=BLUE)\nself.play(Create(c))",
        "Square": "sq = Square(side_length=2, color=RED)\nself.play(Create(sq))",
        "Rectangle": "r = Rectangle(width=3, height=1.5, color=GREEN)\nself.play(Create(r))",
        "Dot": "d = Dot(point=ORIGIN, color=YELLOW)\nself.add(d)",
        "Line": "l = Line(LEFT, RIGHT, color=WHITE)\nself.play(Create(l))",
        "Arrow": "a = Arrow(LEFT, RIGHT, buff=0, color=GREEN)\nself.play(Create(a))",
        "VGroup": "g = VGroup(Circle(), Square()).arrange(RIGHT)\nself.play(Create(g))",
        "ValueTracker": "t = ValueTracker(0)\nalways_redraw(lambda: Dot(ax.c2p(t.get_value(), 0)))",
        "always_redraw": "d = always_redraw(lambda: Dot(ax.c2p(tracker.get_value(), 0)))",
        "DecimalNumber": "n = DecimalNumber(0, num_decimal_places=2)\nn.add_updater(lambda m: m.set_value(tracker.get_value()))",
        "Indicate": "self.play(Indicate(mob, color=YELLOW, scale_factor=1.2))",
        "GrowFromCenter": "self.play(GrowFromCenter(Square()))",
        "SurroundingRectangle": "rect = SurroundingRectangle(label, color=YELLOW)\nself.play(Create(rect))",
        "BraceBetweenPoints": "b = BraceBetweenPoints(LEFT, RIGHT)\nself.play(Create(b))",
        "Polygon": "p = Polygon(UP, RIGHT, DOWN, LEFT, color=PURPLE)\nself.play(Create(p))",
        "ParametricFunction": "f = ParametricFunction(lambda t: [np.cos(t), np.sin(t), 0], t_range=[0, TAU])\nself.play(Create(f))",
        "VoiceoverScene": "class MyScene(VoiceoverScene):\n    def construct(self):\n        with self.voiceover(text='Hello') as tracker:\n            self.play(Create(Square()), run_time=tracker.duration)",
    }
    return known.get(name, f"obj = {name}(...)\nself.add(obj)")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "src" / "assets" / "manim_cheatsheet.json",
    )
    parser.add_argument(
        "--plugins-root",
        type=Path,
        default=PLUGINS_ROOT,
        help="Root directory containing the 6 plugin dirs",
    )
    args = parser.parse_args()

    # Update plugin dirs if a custom root was supplied
    if args.plugins_root != PLUGINS_ROOT:
        for meta in PLUGIN_META.values():
            meta["dir"] = args.plugins_root / meta["dir"].name

    cheatsheet = build_cheatsheet()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(cheatsheet, indent=2, ensure_ascii=False))

    core_n = sum(1 for e in cheatsheet.values() if e["source"] == "manim")
    plugin_n = len(cheatsheet) - core_n
    print(f"\nWrote {len(cheatsheet)} entries to {args.out}")
    print(f"  core: {core_n}  plugins: {plugin_n}")


if __name__ == "__main__":
    main()
