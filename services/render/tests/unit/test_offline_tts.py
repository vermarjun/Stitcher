"""Unit tests for stitcher_voiceover.OfflineTTS — the offline SpeechService.

These exercise the FROZEN cross-repo contract (see /tmp/vo-contract.md):
  - generate_from_text returns the EXACT dict shape when the clip exists;
  - it raises RuntimeError (naming the expected path + normalized text) when the
    clip is missing — and makes no network call;
  - normalize_text + cache_key reproduce the known spike values byte-for-byte.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from stitcher_voiceover import OfflineTTS, cache_key, normalize_text

# Stable spike value: sha256(normalize_text("The quick brown fox")). If this ever
# changes, the worker and render service have drifted and audio filenames won't line up.
_FOX_TEXT = "The quick brown fox"
_FOX_KEY = "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9"


def test_normalize_text_collapses_whitespace_and_strips() -> None:
    assert normalize_text("  The   quick\tbrown\nfox  ") == "The quick brown fox"


def test_cache_key_matches_known_spike_value() -> None:
    assert cache_key(_FOX_TEXT) == _FOX_KEY
    # Whitespace variants normalize to the SAME key (worker/render must agree).
    assert cache_key("  The   quick  brown   fox ") == _FOX_KEY


def test_generate_from_text_returns_contract_shape(tmp_path: Path) -> None:
    (tmp_path / f"{_FOX_KEY}.mp3").write_bytes(b"ID3fakebytes")

    result = OfflineTTS(cache_dir=str(tmp_path)).generate_from_text(_FOX_TEXT)

    assert result == {
        "input_text": _FOX_TEXT,
        "input_data": {"input_text": _FOX_TEXT, "service": "offline-tts"},
        "original_audio": f"{_FOX_KEY}.mp3",
        "word_boundaries": [],
    }


def test_generate_from_text_raises_when_clip_missing(tmp_path: Path) -> None:
    # Empty cache dir -> the expected mp3 is absent.
    with pytest.raises(RuntimeError) as exc:
        OfflineTTS(cache_dir=str(tmp_path)).generate_from_text("  The quick brown fox  ")

    msg = str(exc.value)
    # Names the expected file (so the debug loop can stage it) ...
    assert f"{_FOX_KEY}.mp3" in msg
    assert str(tmp_path) in msg
    # ... and surfaces the normalized + raw text.
    assert "The quick brown fox" in msg
    assert _FOX_KEY in msg
