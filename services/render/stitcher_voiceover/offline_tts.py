"""OfflineTTS: a fully offline manim-voiceover SpeechService.

It NEVER makes a network call. It expects that, for every narration line, a
pre-generated MP3 already exists in the cache directory, named after a
deterministic sha256 hash of the NORMALIZED narration text::

    <sha256(normalized_text)>.mp3

The pre-generation step (gTTS, ElevenLabs, Azure, ...) happens OUTSIDE of this
class, in the worker, with network access. At render time (inside the sandbox)
this class only reads local files and computes audio duration with mutagen.

FROZEN cross-repo contract (must match the worker byte-for-byte):

    import hashlib, unicodedata
    def normalize_text(text: str) -> str:
        text = unicodedata.normalize("NFC", text)
        text = " ".join(text.split())   # strip + collapse ALL internal whitespace
        return text
    def cache_key(text: str) -> str:
        return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()
    # audio filename = f"{cache_key(text)}.mp3"

Behaviour notes (verified against manim_voiceover 0.3.7):
  - SpeechService._wrap_generate_from_text() normalizes text with
    `" ".join(text.split())`, then calls generate_from_text(text, cache_dir=None,
    path=..., **kwargs). It reads dict_["original_audio"] (a filename RELATIVE to
    self.cache_dir). When global_speed == 1 it sets
    dict_["final_audio"] = dict_["original_audio"] (so SoX is never invoked).
  - VoiceoverScene.add_voiceover_text() does
    self.add_sound(cache_dir / dict_["final_audio"]) and builds a
    VoiceoverTracker(self, dict_, cache_dir).
  - VoiceoverTracker.__init__ sets
    self.duration = get_duration(cache_dir / dict_["final_audio"]),
    where get_duration() = mutagen MP3(path).info.length. So tracker.duration is
    the REAL mp3 duration and drives run_time=tracker.duration.
  - word_boundaries is OPTIONAL. We include an empty list -> the tracker's
    fallback word boundaries kick in, so even bookmark code paths won't crash.

`cache_dir` default = manim's `<media_dir>/voiceovers`. The render service always
passes `--media_dir /work/media`, so the default resolves to
`/work/media/voiceovers`. Generated code may call `OfflineTTS()` with no args and
rely on this default.
"""

from __future__ import annotations

import hashlib
import unicodedata
from pathlib import Path

from manim_voiceover.helper import remove_bookmarks
from manim_voiceover.services.base import SpeechService

__all__ = ["OfflineTTS", "cache_key", "normalize_text"]


def normalize_text(text: str) -> str:
    """Deterministic normalization used for the cache key.

    Steps:
      1. Unicode NFC normalization (canonical composition).
      2. Strip leading/trailing whitespace.
      3. Collapse all internal runs of whitespace to a single space.

    This MUST exactly match the normalization used by the pre-generation worker,
    otherwise the hashes (and therefore filenames) will not line up. It also
    mirrors manim_voiceover's own normalization (`" ".join(text.split())`) so that
    whatever text the scene passes resolves to the same key the worker used.
    """
    text = unicodedata.normalize("NFC", text)
    text = " ".join(text.split())
    return text


def cache_key(text: str) -> str:
    """sha256 hex digest of the normalized text (the mp3 basename, no extension)."""
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class OfflineTTS(SpeechService):
    """A SpeechService that reads pre-generated MP3s from a local cache dir.

    Args:
        cache_dir: directory where ``<sha256(normalized_text)>.mp3`` files live.
            If None, falls back to manim_voiceover's default
            (``<media_dir>/voiceovers``), same as the base class.
    """

    def __init__(self, cache_dir: str | None = None, **kwargs) -> None:
        # Force global_speed=1 so the base class never calls adjust_speed()
        # (which needs the SoX *binary*, unavailable in the offline sandbox).
        # Hard-pin even if a caller passes something else.
        kwargs["global_speed"] = 1.0
        # We never transcribe -> no whisper/torch dependency.
        kwargs.pop("transcription_model", None)
        super().__init__(cache_dir=cache_dir, **kwargs)

    def generate_from_text(self, text: str, cache_dir: str | None = None,
                           path: str | None = None, **kwargs) -> dict:
        if cache_dir is None:
            cache_dir = self.cache_dir
        cache_dir = Path(cache_dir)

        # input_text: what the tracker/subcaptions display. Strip bookmarks
        # (matches gtts service). input_data is the cache-identity key inside
        # the cache.json that the base class maintains.
        input_text = remove_bookmarks(text)
        input_data = {"input_text": input_text, "service": "offline-tts"}

        # If the base class already cached an identical entry, reuse it.
        cached_result = self.get_cached_result(input_data, cache_dir)
        if cached_result is not None:
            return cached_result

        key = cache_key(text)
        audio_filename = f"{key}.mp3"
        audio_abspath = cache_dir / audio_filename

        if not audio_abspath.exists():
            raise RuntimeError(
                "OfflineTTS: pre-generated audio NOT found.\n"
                f"  expected file : {audio_abspath}\n"
                f"  cache key     : {key}\n"
                f"  normalized    : {normalize_text(text)!r}\n"
                f"  raw text      : {text!r}\n"
                "The worker must pre-generate this MP3 (offline render makes no "
                "network calls). Ensure the worker uses the SAME normalize_text() "
                "+ sha256 scheme to name the file."
            )

        # Return EXACTLY the minimal shape the base class requires.
        # original_audio MUST be a path/filename relative to cache_dir.
        # word_boundaries=[] is optional but lets bookmark code use fallbacks
        # instead of raising.
        return {
            "input_text": text,
            "input_data": input_data,
            "original_audio": audio_filename,
            "word_boundaries": [],
        }
