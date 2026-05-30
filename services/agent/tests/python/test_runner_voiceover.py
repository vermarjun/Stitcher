"""Unit tests for src/validation/runner.py voiceover logic.

Run with: python3 -m pytest tests/python -q

These directly exercise the Python beat-check + the shared hash. The cache_key
value asserted here is the FROZEN cross-service contract value: it MUST equal the
render service's `stitcher_voiceover.cache_key` for the same input (see
/tmp/vo-contract.md and /tmp/vo-spike/offline_tts.py — both use NFC + whitespace
collapse + sha256). If this assertion ever changes, audio filenames written by
the worker would stop lining up with what OfflineTTS looks for at render time.
"""

import importlib.util
import os
import sys
import unicodedata

_RUNNER = os.path.join(os.path.dirname(__file__), "..", "..", "src", "validation", "runner.py")
_spec = importlib.util.spec_from_file_location("vo_runner", os.path.abspath(_RUNNER))
runner = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(runner)


NARRATION = [
    "Here is a sorted array of numbers.",
    "Binary search looks at the middle element to decide which half to keep.",
]


def _scene(beats):
    blocks = "\n".join(
        f"        with self.voiceover(text={beat!r}) as tracker:\n"
        f"            self.play(Write(Text('x')), run_time=tracker.duration)"
        for beat in beats
    )
    return (
        "from manim import *\n"
        "from manim_voiceover import VoiceoverScene\n"
        "from stitcher_voiceover import OfflineTTS\n\n"
        "class Scene00(VoiceoverScene):\n"
        "    def construct(self):\n"
        "        self.set_speech_service(OfflineTTS(), create_subcaption=False)\n"
        f"{blocks}\n"
    )


# ── normalize_text / cache_key: stable, known, cross-service values ──────────

def test_normalize_text_collapses_whitespace_and_nfc():
    assert runner.normalize_text("  hello   world  ") == "hello world"
    assert runner.normalize_text("a\t b\nc") == "a b c"
    # NFD 'é' (e + combining acute) NFC-composes to a single codepoint
    nfd = "café"
    assert runner.normalize_text(nfd) == unicodedata.normalize("NFC", "café")
    assert runner.normalize_text("  café   menu ") == "café menu"


def test_cache_key_is_frozen_contract_value():
    # MUST match render service stitcher_voiceover.cache_key("The quick brown fox")
    assert (
        runner.cache_key("The quick brown fox")
        == "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9"
    )
    # whitespace/NFC variants hash identically (stability of the key)
    assert runner.cache_key("  The   quick  brown   fox ") == runner.cache_key(
        "The quick brown fox"
    )


# ── check_voiceover_beats ────────────────────────────────────────────────────

def test_exact_match_passes():
    assert runner.check_voiceover_beats(_scene(NARRATION), NARRATION) == {"status": "ok"}


def test_reworded_beat_fails_with_missing_and_altered():
    reworded = [NARRATION[0], "Binary search checks the center element each time."]
    res = runner.check_voiceover_beats(_scene(reworded), NARRATION)
    assert res["status"] == "fail"
    assert "voiceover narration drift" in res["error"]
    assert "MISSING" in res["error"] and "EXTRA/ALTERED" in res["error"]


def test_non_literal_fstring_fails():
    code = (
        "from manim import *\n"
        "from manim_voiceover import VoiceoverScene\n"
        "from stitcher_voiceover import OfflineTTS\n\n"
        "class Scene00(VoiceoverScene):\n"
        "    def construct(self):\n"
        "        self.set_speech_service(OfflineTTS(), create_subcaption=False)\n"
        "        beat = 'x'\n"
        "        with self.voiceover(text=f'{beat}') as tracker:\n"
        "            self.play(Write(Text('x')), run_time=tracker.duration)\n"
    )
    res = runner.check_voiceover_beats(code, NARRATION)
    assert res["status"] == "fail"
    assert "plain string literal" in res["error"]


def test_count_mismatch_extra_block_fails_on_count():
    extra = [NARRATION[0], NARRATION[1], NARRATION[0]]
    res = runner.check_voiceover_beats(_scene(extra), NARRATION)
    assert res["status"] == "fail"
    assert "block count" in res["error"]


def test_count_mismatch_missing_block_fails():
    res = runner.check_voiceover_beats(_scene([NARRATION[0]]), NARRATION)
    assert res["status"] == "fail"
    # set inequality (one beat missing) -> drift message
    assert "voiceover narration drift" in res["error"]


def test_duplicated_plus_missing_same_count_fails_set_equality():
    dup = [NARRATION[0], NARRATION[0]]  # count 2 == narration 2, but set differs
    res = runner.check_voiceover_beats(_scene(dup), NARRATION)
    assert res["status"] == "fail"
    assert "voiceover narration drift" in res["error"]
    assert "MISSING" in res["error"]


def test_whitespace_and_nfc_variants_normalize_to_pass():
    narration = ["café menu", "second beat here"]
    in_code = ["   café   menu  ", "second   beat\there"]
    assert runner.check_voiceover_beats(_scene(in_code), narration) == {"status": "ok"}


def test_no_narration_skips_check():
    # voiceover OFF / no beats supplied -> check is a no-op pass
    assert runner.check_voiceover_beats("class Scene00(Scene): pass", None) == {"status": "ok"}
    assert runner.check_voiceover_beats("class Scene00(Scene): pass", []) == {"status": "ok"}


# ── security regression guard (check_manim_lint) ─────────────────────────────

def test_banned_imports_and_calls_still_rejected():
    for snippet in ["import socket", "import subprocess", "from socket import x"]:
        res = runner.check_manim_lint(snippet + "\nx = 1\n")
        assert res["status"] == "fail", snippet
    for call in ["os.system('ls')", "eval('1+1')"]:
        res = runner.check_manim_lint("y = 1\n" + call + "\n")
        assert res["status"] == "fail", call
