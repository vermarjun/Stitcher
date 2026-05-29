"""
Manim API Documentation Scraper
================================
Fetches Manim source from GitHub, parses docstrings via AST + docstring_parser,
and builds 3-level hierarchical chunks (module / class / method) for RAG ingestion.

Output: output/chunks_all.json  (+ split files + stats)
"""

import ast
import re
import json
import time
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from collections import Counter

import requests
import docstring_parser
from docstring_parser import DocstringStyle
from tqdm import tqdm

# ── Configuration ──────────────────────────────────────────────────────────────
MANIM_TAG     = "v0.19.0"   # matches manimVersion in seed_examples.json
MANIM_VERSION = "0.19.0"
GITHUB_TOKEN  = os.environ.get("GITHUB_TOKEN")   # optional PAT for higher rate limits
OUTPUT_DIR    = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
SCRAPED_AT    = datetime.now(timezone.utc).isoformat()
REQUEST_DELAY = 0.05   # seconds between raw file GETs

BASE_RAW = f"https://raw.githubusercontent.com/ManimCommunity/manim/{MANIM_TAG}"
BASE_API = "https://api.github.com/repos/ManimCommunity/manim"

INCLUDE_DIRS = [
    "manim/animation",
    "manim/camera",
    "manim/mobject",
    "manim/scene",
    "manim/utils",
]
INCLUDE_TOP_FILES = [
    "manim/constants.py",
    "manim/typing.py",
]
EXCLUDE_PATTERNS = [
    "__init__", "__pycache__", "opengl", "docbuild",
    "testing", "_config", "cli", "plugins", "renderer", "templates",
]


# ── Category helper ────────────────────────────────────────────────────────────
def get_category(module_path: str) -> str:
    if module_path.startswith("animation"): return "animations"
    if module_path.startswith("camera"):    return "cameras"
    if module_path.startswith("mobject"):   return "mobjects"
    if module_path.startswith("scene"):     return "scenes"
    return "utilities"


# ── GitHub helpers ─────────────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers["Accept"] = "application/vnd.github.v3+json"
if GITHUB_TOKEN:
    SESSION.headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"


def get_file_tree(tag: str) -> list[dict]:
    url = f"{BASE_API}/git/trees/{tag}?recursive=1"
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("truncated"):
        print("WARNING: GitHub tree was truncated.")
    return [item for item in data["tree"] if item["type"] == "blob"]


def fetch_raw(path: str) -> Optional[str]:
    url = f"{BASE_RAW}/{path}"
    try:
        r = SESSION.get(url, timeout=30)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  FAILED {path}: {e}")
        return None


def should_include(path: str) -> bool:
    if not path.endswith(".py"):
        return False
    if path in INCLUDE_TOP_FILES:
        return True
    for pat in EXCLUDE_PATTERNS:
        if pat in path:
            return False
    return any(path.startswith(d + "/") for d in INCLUDE_DIRS)


def path_to_module(path: str) -> str:
    return path.removeprefix("manim/").removesuffix(".py").replace("/", ".")


# ── AST helpers ────────────────────────────────────────────────────────────────
def parse_source(src: str):
    try:
        return ast.parse(src)
    except SyntaxError:
        return None


def get_base_names(cls_node: ast.ClassDef) -> list[str]:
    names = []
    for base in cls_node.bases:
        if isinstance(base, ast.Name):
            names.append(base.id)
        elif isinstance(base, ast.Attribute):
            names.append(base.attr)
    return names


def get_func_signature(fn: ast.FunctionDef) -> str:
    args = fn.args
    parts = []
    n = len(args.args)
    nd = len(args.defaults)
    for i, arg in enumerate(args.args):
        if arg.arg == "self":
            continue
        di = i - (n - nd)
        if di >= 0:
            try:
                parts.append(f"{arg.arg}={ast.unparse(args.defaults[di])}")
            except Exception:
                parts.append(f"{arg.arg}=...")
        else:
            parts.append(arg.arg)
    if args.vararg:
        parts.append(f"*{args.vararg.arg}")
    if args.kwarg:
        parts.append(f"**{args.kwarg.arg}")
    return f"{fn.name}({', '.join(parts)})"


def get_documented_methods(cls_node: ast.ClassDef) -> list:
    result = []
    for m in cls_node.body:
        if not isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if m.name.startswith("_") and m.name not in ("__init__",):
            continue
        doc = ast.get_docstring(m) or ""
        if len(doc.strip()) > 30:
            result.append(m)
    return result


# ── Docstring helpers ──────────────────────────────────────────────────────────
def parse_doc(raw: Optional[str]):
    if not raw or not raw.strip():
        return None
    try:
        p = docstring_parser.parse(raw, style=DocstringStyle.NUMPYDOC)
        if p.short_description:
            return p
        return docstring_parser.parse(raw)
    except Exception:
        return None


def short_desc(p) -> str:
    return (p.short_description or "").strip() if p else ""


def long_desc(p) -> str:
    return (p.long_description or "").strip() if p else ""


def params_text(p) -> str:
    if not p or not p.params:
        return ""
    lines = []
    for param in p.params:
        desc = clean_rst((param.description or "").replace("\n", " ").strip())
        t = f" ({param.type_name})" if param.type_name else ""
        lines.append(f"  {param.arg_name}{t}: {desc}" if desc else f"  {param.arg_name}{t}")
    return "\n".join(lines)


def returns_text(p) -> str:
    if not p:
        return ""
    rs = list(p.many_returns)
    if not rs:
        return ""
    parts = []
    for r in rs:
        t = r.type_name or ""
        d = (r.description or "").replace("\n", " ").strip()
        if t and d:
            parts.append(f"{t}: {d}")
        elif t:
            parts.append(t)
        elif d:
            parts.append(d)
    return "; ".join(parts)


def raises_text(p) -> str:
    if not p or not p.raises:
        return ""
    return "\n".join(
        f"  {r.type_name}: {(r.description or '').replace(chr(10), ' ').strip()}"
        for r in p.raises
    )


_MANIM_DIR = re.compile(
    r'\.\. manim::[ \t]*\w+[^\n]*\n((?:(?:[ \t]+.*)\n|\n)*)',
    re.MULTILINE
)
_RST_ROLE   = re.compile(r':[a-z_]+:`~?\.?([^`]+)`')
_RST_BLOCK  = re.compile(r'\.\.\s+\w[^\n]*\n(?:[ \t]+[^\n]*\n)*')
_RST_OPTION = re.compile(r'^[ \t]*:\w[\w-]*:[ \t]*\w*\s*$', re.MULTILINE)
_RST_NOTE   = re.compile(r'\.\. NOTE.*?\n', re.IGNORECASE)


def extract_manim_examples(raw: str) -> list[str]:
    out = []
    for m in _MANIM_DIR.finditer(raw):
        lines = m.group(1).split("\n")
        dedented = []
        for line in lines:
            stripped = line[4:] if line.startswith("    ") else line
            # Skip RST directive options like :save_last_frame:
            if re.match(r'^:\w[\w-]*:[ \t]*\w*\s*$', stripped.strip()):
                continue
            dedented.append(stripped)
        code = "\n".join(dedented).strip()
        if len(code) > 20:
            out.append(code)
    return out


def extract_doctest_examples(raw: str) -> list[str]:
    lines = re.findall(r'^[ \t]*>>>[ \t]?(.+)', raw, re.MULTILINE)
    return ["\n".join(lines)] if lines else []


def clean_rst(text: str) -> str:
    # Replace :class:`~.Foo` -> Foo, :meth:`foo` -> foo, etc.
    text = _RST_ROLE.sub(r'\1', text)
    # Remove .. directive blocks
    text = _RST_BLOCK.sub('', text)
    # Remove orphan RST option lines like :save_last_frame:
    text = _RST_OPTION.sub('', text)
    # Remove .. NOTE (:) patterns
    text = _RST_NOTE.sub('', text)
    # Clean double-backtick literals -> normal
    text = re.sub(r'``([^`]+)``', r'\1', text)
    # Collapse excess blank lines
    return re.sub(r'\n{3,}', '\n\n', text).strip()


def get_see_also(raw: str) -> list[str]:
    m = re.search(
        r'(?:See Also|see also)\n[-=]+\n(.*?)(?=\n[A-Z][\w ]+\n[-=]+|\Z)',
        raw, re.DOTALL
    )
    if not m:
        return []
    return [n.split('.')[-1] for n in re.findall(r':[a-z]+:`~?\.?([\w.]+)`', m.group(1))]


# ── Content builders ───────────────────────────────────────────────────────────
def make_id(*parts: str) -> str:
    return "_".join(p.replace(".", "_").replace("/", "_") for p in parts).lower()


def build_module_content(module_path, category, module_doc, class_sums, func_sums) -> str:
    lines = [f"Manim module: {module_path} (category: {category})"]
    if module_doc:
        first = module_doc.strip().split("\n")[0][:200]
        lines.append(clean_rst(first))
    if class_sums:
        lines.append("Classes:")
        for name, s in class_sums:
            lines.append(f"  - {name}: {clean_rst(s[:120]) if s else '(no description)'}")
    if func_sums:
        lines.append("Functions:")
        for name, s in func_sums:
            lines.append(f"  - {name}(): {clean_rst(s[:120]) if s else '(no description)'}")
    return "\n".join(lines)


def build_class_content(class_name, module_path, category, bases,
                         sd, ld, pt, rt, rst, examples, see_also) -> str:
    lines = [
        f"Manim class: {class_name}",
        f"Module: manim.{module_path} | Category: {category}",
    ]
    if bases:
        lines.append(f"Inherits from: {' → '.join(bases)}")
    lines.append("")
    if sd:
        lines.append(f"What it does: {clean_rst(sd)}")
    if ld:
        cleaned = clean_rst(ld)
        if len(cleaned) > 600:
            cleaned = cleaned[:600].rsplit(" ", 1)[0] + "..."
        lines.append(cleaned)
    if pt:
        lines.append("")
        lines.append("Parameters:")
        lines.append(pt)
    if rst:
        lines.append("")
        lines.append("Raises:")
        lines.append(rst)
    if examples:
        lines.append("")
        lines.append("Usage example:")
        ex = examples[0][:500]
        lines.extend(f"  {l}" for l in ex.split("\n"))
    if see_also:
        lines.append("")
        lines.append(f"Related: {', '.join(see_also)}")
    return "\n".join(lines)


def build_method_content(class_name, method_name, module_path, category,
                          sig, sd, ld, pt, rt, examples) -> str:
    lines = [
        f"Manim method: {class_name}.{method_name}()",
        f"Module: manim.{module_path} | Category: {category}",
        "",
    ]
    if sig:
        lines.append(f"Signature: {class_name}.{sig}")
    if sd:
        lines.append("")
        lines.append(f"What it does: {clean_rst(sd)}")
    if ld:
        cleaned = clean_rst(ld)
        if len(cleaned) > 400:
            cleaned = cleaned[:400].rsplit(" ", 1)[0] + "..."
        lines.append(cleaned)
    if pt:
        lines.append("")
        lines.append("Parameters:")
        lines.append(pt)
    if rt:
        lines.append("")
        lines.append(f"Returns: {rt}")
    if examples:
        lines.append("")
        lines.append("Example usage:")
        ex = examples[0][:300]
        lines.extend(f"  {l}" for l in ex.split("\n"))
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # Step 1: Discover target files
    print(f"Fetching file tree for {MANIM_TAG}...")
    all_files = get_file_tree(MANIM_TAG)
    targets = [f["path"] for f in all_files if should_include(f["path"])]
    print(f"Target files: {len(targets)} (of {len(all_files)} total)")

    # Step 2: Fetch + parse
    parsed_modules: dict[str, dict] = {}
    failures = []

    for path in tqdm(targets, desc="Fetching & parsing"):
        mod_path = path_to_module(path)
        src = fetch_raw(path)
        if src is None:
            failures.append((path, "fetch_failed"))
            time.sleep(REQUEST_DELAY)
            continue
        tree = parse_source(src)
        if tree is None:
            failures.append((path, "syntax_error"))
            time.sleep(REQUEST_DELAY)
            continue

        classes = []
        for cls_node in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
            raw = ast.get_docstring(cls_node) or ""
            p = parse_doc(raw)
            methods = []
            for m in get_documented_methods(cls_node):
                m_raw = ast.get_docstring(m) or ""
                m_p = parse_doc(m_raw)
                methods.append({
                    "name": m.name,
                    "signature": get_func_signature(m),
                    "raw_doc": m_raw,
                    "parsed_doc": m_p,
                    "manim_examples": extract_manim_examples(m_raw),
                    "doctest_examples": extract_doctest_examples(m_raw),
                })
            classes.append({
                "name": cls_node.name,
                "bases": get_base_names(cls_node),
                "raw_doc": raw,
                "parsed_doc": p,
                "manim_examples": extract_manim_examples(raw),
                "doctest_examples": extract_doctest_examples(raw),
                "see_also": get_see_also(raw),
                "methods": methods,
            })

        fns = []
        for fn in [n for n in tree.body
                   if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                   and not n.name.startswith("_")]:
            fn_raw = ast.get_docstring(fn) or ""
            fns.append({
                "name": fn.name,
                "signature": get_func_signature(fn),
                "raw_doc": fn_raw,
                "parsed_doc": parse_doc(fn_raw),
                "manim_examples": extract_manim_examples(fn_raw),
            })

        parsed_modules[mod_path] = {
            "path": path,
            "module_path": mod_path,
            "module_doc": ast.get_docstring(tree),
            "classes": classes,
            "functions": fns,
        }
        time.sleep(REQUEST_DELAY)

    print(f"\nParsed: {len(parsed_modules)} modules | Failures: {len(failures)}")
    for p, reason in failures:
        print(f"  [{reason}] {p}")

    # Step 3: Build Level 1 — module summaries
    level1 = []
    for mod_path, mod in parsed_modules.items():
        category = get_category(mod_path)
        class_sums = [(c["name"], short_desc(c["parsed_doc"])) for c in mod["classes"]]
        func_sums  = [(f["name"], short_desc(f["parsed_doc"])) for f in mod["functions"]]
        if not class_sums and not func_sums and not mod["module_doc"]:
            continue
        content = build_module_content(mod_path, category, mod["module_doc"], class_sums, func_sums)
        level1.append({
            "id": make_id("mod", mod_path),
            "level": "module",
            "module": mod_path,
            "category": category,
            "className": None,
            "methodName": None,
            "fullyQualifiedName": f"manim.{mod_path}",
            "content": content,
            "hasExample": False,
            "exampleCode": None,
            "parentChunkId": None,
            "inheritedFrom": None,
            "manimVersion": MANIM_VERSION,
            "scrapedAt": SCRAPED_AT,
        })

    # Step 4: Build Level 2 — class docs
    level2 = []
    for mod_path, mod in parsed_modules.items():
        category = get_category(mod_path)
        mod_id = make_id("mod", mod_path)
        for cls in mod["classes"]:
            p = cls["parsed_doc"]
            sd = short_desc(p)
            ld = long_desc(p)
            pt = params_text(p)
            rt = returns_text(p)
            rst = raises_text(p)
            examples = cls["manim_examples"] + cls["doctest_examples"]
            content = build_class_content(
                cls["name"], mod_path, category, cls["bases"],
                sd, ld, pt, rt, rst, examples, cls["see_also"]
            )
            level2.append({
                "id": make_id("class", "manim", mod_path, cls["name"]),
                "level": "class",
                "module": mod_path,
                "category": category,
                "className": cls["name"],
                "methodName": None,
                "fullyQualifiedName": f"manim.{mod_path}.{cls['name']}",
                "content": content,
                "hasExample": len(examples) > 0,
                "exampleCode": examples[0] if examples else None,
                "parentChunkId": mod_id,
                "inheritedFrom": cls["bases"],
                "methodNames": [m["name"] for m in cls["methods"]],
                "hasDocstring": bool(sd or ld),
                "manimVersion": MANIM_VERSION,
                "scrapedAt": SCRAPED_AT,
            })

    # Step 5: Build Level 3 — method docs
    level3 = []
    for mod_path, mod in parsed_modules.items():
        category = get_category(mod_path)
        for cls in mod["classes"]:
            cls_id = make_id("class", "manim", mod_path, cls["name"])
            for method in cls["methods"]:
                p = method["parsed_doc"]
                if not p:
                    continue
                sd = short_desc(p)
                ld = long_desc(p)
                if method["name"] == "__init__" and not sd:
                    continue
                pt = params_text(p)
                rt = returns_text(p)
                examples = method["manim_examples"] + method["doctest_examples"]
                content = build_method_content(
                    cls["name"], method["name"],
                    mod_path, category,
                    method["signature"],
                    sd, ld, pt, rt, examples
                )
                level3.append({
                    "id": make_id("method", "manim", mod_path, cls["name"], method["name"]),
                    "level": "method",
                    "module": mod_path,
                    "category": category,
                    "className": cls["name"],
                    "methodName": method["name"],
                    "fullyQualifiedName": f"manim.{mod_path}.{cls['name']}.{method['name']}",
                    "content": content,
                    "hasExample": len(examples) > 0,
                    "exampleCode": examples[0] if examples else None,
                    "parentChunkId": cls_id,
                    "inheritedFrom": None,
                    "manimVersion": MANIM_VERSION,
                    "scrapedAt": SCRAPED_AT,
                })

    all_chunks = level1 + level2 + level3

    # Dedup
    seen = set()
    deduped = []
    for c in all_chunks:
        if c["id"] not in seen:
            seen.add(c["id"])
            deduped.append(c)
        else:
            print(f"  DUPLICATE: {c['id']}")
    all_chunks = deduped

    # ── Analysis ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("CHUNK ANALYSIS REPORT")
    print("=" * 60)

    print(f"\nTotal chunks: {len(all_chunks)}")
    print(f"  Level 1 (module):  {len(level1)}")
    print(f"  Level 2 (class):   {len(level2)}")
    print(f"  Level 3 (method):  {len(level3)}")

    print("\n── By category:")
    for cat, cnt in sorted(Counter(c["category"] for c in all_chunks).items()):
        print(f"  {cat:<15} {cnt}")

    print("\n── Category × Level:")
    cats = sorted(set(c["category"] for c in all_chunks))
    print(f"  {'Category':<15} {'L1':>4} {'L2':>5} {'L3':>5}")
    print(f"  {'-'*31}")
    for cat in cats:
        l1 = sum(1 for c in level1 if c["category"] == cat)
        l2 = sum(1 for c in level2 if c["category"] == cat)
        l3 = sum(1 for c in level3 if c["category"] == cat)
        print(f"  {cat:<15} {l1:>4} {l2:>5} {l3:>5}")

    print(f"\n── Level 2 class coverage:")
    print(f"  Total classes:        {len(level2)}")
    with_doc = sum(1 for c in level2 if c["hasDocstring"])
    with_ex  = sum(1 for c in level2 if c["hasExample"])
    print(f"  Have docstring:       {with_doc} ({100*with_doc//max(len(level2),1)}%)")
    print(f"  Have code example:    {with_ex}  ({100*with_ex//max(len(level2),1)}%)")

    print(f"\n── Top 10 most documented classes (by method count):")
    mc = Counter(c["className"] for c in level3)
    for cls_name, cnt in mc.most_common(10):
        print(f"  {cls_name:<35} {cnt} methods")

    print("\n── Key class presence check:")
    KEY_CLASSES = [
        "Scene", "Mobject", "VMobject", "Animation",
        "Create", "FadeIn", "FadeOut", "Write", "Transform",
        "ReplacementTransform", "LaggedStart", "AnimationGroup", "Succession",
        "Circle", "Square", "Rectangle", "Triangle", "Arrow", "Line",
        "Dot", "Polygon", "Star",
        "Text", "MathTex", "Tex", "MarkupText",
        "VGroup", "ValueTracker",
        "Axes", "NumberPlane", "NumberLine", "ThreeDAxes",
        "Indicate", "Flash", "Circumscribe", "ShowPassingFlash", "FocusOn",
        "ThreeDScene", "MovingCameraScene",
        "Surface", "Sphere", "Cube",
        "Graph", "Table", "BarChart",
        "Brace", "SurroundingRectangle",
    ]
    present = {c["className"] for c in level2}
    missing = []
    for name in KEY_CLASSES:
        status = "✓" if name in present else "✗"
        print(f"  {status}  {name}")
        if name not in present:
            missing.append(name)

    if missing:
        print(f"\n  MISSING {len(missing)} key classes: {', '.join(missing)}")

    print("\n── Content length (chars):")
    for label, chunks in [("module", level1), ("class", level2), ("method", level3)]:
        if chunks:
            lengths = [len(c["content"]) for c in chunks]
            avg = sum(lengths) / len(lengths)
            print(f"  {label:<8}: avg={avg:.0f}  min={min(lengths)}  max={max(lengths)}")

    # ── Preview key classes ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SAMPLE CHUNKS")
    print("=" * 60)
    for cls_name in ["Scene", "Create", "Transform", "VGroup", "Circle", "Text", "Axes"]:
        matches = [c for c in level2 if c["className"] == cls_name]
        if matches:
            c = matches[0]
            print(f"\n── {cls_name} (class) — {len(c['content'])} chars, example={c['hasExample']} ──")
            print(c["content"][:700])
            print("  ...")

    # ── Save ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SAVING OUTPUT")
    print("=" * 60)

    def save(data, name):
        path = OUTPUT_DIR / name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        kb = path.stat().st_size / 1024
        n = len(data) if isinstance(data, list) else 1
        print(f"  {name:<45} {n:>5} items  {kb:>8.1f} KB")

    save(all_chunks,  "chunks_all.json")
    save(level1,      "chunks_level1_modules.json")
    save(level2,      "chunks_level2_classes.json")
    save(level3,      "chunks_level3_methods.json")

    stats = {
        "manimVersion": MANIM_VERSION,
        "manimTag": MANIM_TAG,
        "scrapedAt": SCRAPED_AT,
        "modulesScraped": len(parsed_modules),
        "parseFailures": failures,
        "totalChunks": len(all_chunks),
        "level1Count": len(level1),
        "level2Count": len(level2),
        "level3Count": len(level3),
        "level2WithDocstring": with_doc,
        "level2WithExample": with_ex,
        "level3WithExample": sum(1 for c in level3 if c["hasExample"]),
        "chunksByCategory": dict(Counter(c["category"] for c in all_chunks)),
        "missingKeyClasses": missing,
    }
    save(stats, "scrape_stats.json")

    print(f"\nDone. Primary output: {(OUTPUT_DIR / 'chunks_all.json').resolve()}")


if __name__ == "__main__":
    main()
