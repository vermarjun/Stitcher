"""Unit tests for app.core.voiceover.stage_voiceover_bundle.

The host (trusted) decodes the base64 bundle and writes each clip to
`<workdir>/media/voiceovers/<key>.mp3` before the sandbox starts. Invalid/empty
base64 is a caller-attributable failure -> VoiceoverStagingError (surfaced as a
structured render error upstream, never a 500).
"""

from __future__ import annotations

import base64
from pathlib import Path

import pytest

from app.core.voiceover import VoiceoverStagingError, stage_voiceover_bundle
from app.models import VoiceoverEntry, VoiceoverSpec

_KEY = "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9"


def test_stages_valid_entry_to_voiceovers_dir(tmp_path: Path) -> None:
    payload = b"ID3fake-mp3-bytes"
    spec = VoiceoverSpec(audio=[
        VoiceoverEntry(key=_KEY, base64=base64.b64encode(payload).decode()),
    ])

    count = stage_voiceover_bundle(tmp_path, spec)

    staged = tmp_path / "media" / "voiceovers" / f"{_KEY}.mp3"
    assert count == 1
    assert staged.read_bytes() == payload


def test_none_spec_stages_nothing(tmp_path: Path) -> None:
    assert stage_voiceover_bundle(tmp_path, None) == 0
    assert not (tmp_path / "media" / "voiceovers").exists()


def test_invalid_base64_raises_staging_error(tmp_path: Path) -> None:
    # `***` is not valid base64.
    spec = VoiceoverSpec(audio=[VoiceoverEntry(key=_KEY, base64="***")])
    with pytest.raises(VoiceoverStagingError) as exc:
        stage_voiceover_bundle(tmp_path, spec)
    assert _KEY in str(exc.value)


def test_empty_decoded_audio_raises_staging_error(tmp_path: Path) -> None:
    # The model's min_length=1 stops empty base64 at the edge, so to exercise the
    # staging guard directly we bypass validation with model_construct: an entry whose
    # base64 is "" decodes to zero bytes -> VoiceoverStagingError, not a silent empty file.
    entry = VoiceoverEntry.model_construct(key=_KEY, base64="")
    spec = VoiceoverSpec.model_construct(audio=[entry])
    with pytest.raises(VoiceoverStagingError) as exc:
        stage_voiceover_bundle(tmp_path, spec)
    assert "empty" in str(exc.value).lower()
