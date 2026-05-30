"""Stitcher native voiceover support — a fully OFFLINE manim-voiceover SpeechService.

The only public surface is :class:`OfflineTTS`, importable as::

    from stitcher_voiceover import OfflineTTS

It NEVER makes a network call. It expects that, for every narration line, a
pre-generated MP3 already exists in the cache directory, named after a
deterministic sha256 hash of the NORMALIZED narration text. The TTS itself runs
ONLINE in the API worker (with keys + network) and ships the audio as a bundle to
the air-gapped render sandbox, where this class only reads local files.

See ``stitcher_voiceover.offline_tts`` for the implementation and the frozen
cross-repo hashing contract (``normalize_text`` + ``cache_key``).
"""

from __future__ import annotations

from stitcher_voiceover.offline_tts import OfflineTTS, cache_key, normalize_text

__all__ = ["OfflineTTS", "cache_key", "normalize_text"]
