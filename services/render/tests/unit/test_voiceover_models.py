"""Schema tests for the native-voiceover bundle on RenderRequest.

The `voiceover` field is optional. When present, each entry's `key` must be a
64-char sha256 hex string and `base64` must be non-empty — these guard against a
caller shipping a malformed bundle that would otherwise stage garbage filenames.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import RenderRequest

_KEY = "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9"
_CODE = "from manim import *\nclass Scene00(Scene):\n    def construct(self):\n        pass\n"


def _req(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {"code": _CODE, "sceneClass": "Scene00"}
    base.update(overrides)
    return base


def test_accepts_valid_voiceover_bundle() -> None:
    req = RenderRequest.model_validate(_req(
        voiceover={"audio": [{"key": _KEY, "base64": "ID3fake=="}]},
    ))
    assert req.voiceover is not None
    assert req.voiceover.audio[0].key == _KEY


def test_voiceover_absent_is_none() -> None:
    req = RenderRequest.model_validate(_req())
    assert req.voiceover is None


def test_rejects_bad_key_not_64_hex() -> None:
    with pytest.raises(ValidationError):
        RenderRequest.model_validate(_req(
            voiceover={"audio": [{"key": "not-a-hash", "base64": "ID3fake=="}]},
        ))


def test_rejects_empty_base64() -> None:
    with pytest.raises(ValidationError):
        RenderRequest.model_validate(_req(
            voiceover={"audio": [{"key": _KEY, "base64": ""}]},
        ))
