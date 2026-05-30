"""Stage native-voiceover audio into the sandbox workdir before manim runs.

The render request may carry a `voiceover.audio` bundle: one pre-generated mp3 per
narration beat, keyed by sha256(normalize_text(beat)). manim_voiceover's default
cache dir is `<media_dir>/voiceovers`, and the render always passes
`--media_dir /work/media`, so OfflineTTS() (no args) looks in
`<workdir>/media/voiceovers/<key>.mp3`. We write each entry there.

This is SEPARATE from the top-level `audio` post-mux path. Native voiceover audio
is baked by manim via add_sound; it is NOT muxed afterwards. Decoding happens on
the host (trusted) before the sandbox starts — the sandbox itself never touches
the base64 or the network.
"""

from __future__ import annotations

import base64
import binascii
from pathlib import Path

from app.models import VoiceoverSpec


class VoiceoverStagingError(RuntimeError):
    pass


def stage_voiceover_bundle(workdir: Path, spec: VoiceoverSpec | None) -> int:
    """Decode each bundle entry to `<workdir>/media/voiceovers/<key>.mp3`.

    Returns the number of clips staged. Raises VoiceoverStagingError on malformed
    base64 (a caller-attributable failure, surfaced as a structured render error —
    never a 500). A missing clip is NOT detected here: OfflineTTS raises a precise
    RuntimeError at render time naming the expected file and the narration text,
    which the debug loop relies on.
    """
    if spec is None or not spec.audio:
        return 0

    vo_dir = workdir / "media" / "voiceovers"
    vo_dir.mkdir(parents=True, exist_ok=True)

    for entry in spec.audio:
        try:
            data = base64.b64decode(entry.base64, validate=True)
        except binascii.Error as e:
            raise VoiceoverStagingError(
                f"invalid base64 for voiceover clip {entry.key}: {e}"
            ) from e
        if not data:
            raise VoiceoverStagingError(f"empty audio for voiceover clip {entry.key}")
        (vo_dir / f"{entry.key}.mp3").write_bytes(data)

    return len(spec.audio)
