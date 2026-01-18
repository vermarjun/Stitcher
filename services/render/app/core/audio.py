"""Mix an audio track onto a rendered video with ffmpeg.

Contract: `bake_audio(video, audio, offset_sec, gain_db) -> Path` returns a new file in the
same directory; caller owns cleanup of both input and output. We don't re-encode the video
stream (`-c:v copy`), only the audio — keeps the mux cheap and the video lossless.

Gain is applied with `-af volume=<gain>dB`; offset is applied with `-itsoffset` BEFORE the
audio input, which shifts the track in time without re-encoding if we don't overlap.
"""

from __future__ import annotations

import base64
import binascii
import subprocess
import tempfile
from pathlib import Path

from app.config import get_settings


class AudioError(RuntimeError):
    pass


def decode_to_tempfile(b64: str, filename_hint: str = "audio.mp3") -> Path:
    """Write a base64 audio blob to a tempfile, returning its path.

    We trust the extension in `filename_hint` only as a format hint for ffmpeg — the actual
    codec is whatever the bytes say. Validation of max size happens in the HTTP layer
    before this is called, so we can decode straight to disk without a memory cap here.
    """
    try:
        data = base64.b64decode(b64, validate=True)
    except binascii.Error as e:
        raise AudioError(f"invalid base64 audio payload: {e}") from e

    suffix = Path(filename_hint).suffix or ".mp3"
    path = Path(tempfile.mkstemp(prefix="audio-", suffix=suffix)[1])
    path.write_bytes(data)
    return path


def bake(video_path: Path, audio_path: Path, *,
         offset_sec: float = 0.0, gain_db: int = 0) -> Path:
    """Produce a new video file with the audio muxed in. Video stream is copied, not re-encoded."""
    settings = get_settings()
    out = video_path.with_name(video_path.stem + "_muxed" + video_path.suffix)

    cmd: list[str] = [settings.ffmpeg_path, "-y", "-v", "error"]
    if offset_sec > 0:
        cmd += ["-itsoffset", f"{offset_sec:.3f}"]
    cmd += [
        "-i", str(audio_path),
        "-i", str(video_path),
        "-map", "1:v:0", "-map", "0:a:0",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
    ]
    if gain_db != 0:
        cmd += ["-af", f"volume={gain_db}dB"]
    cmd += [str(out)]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired as e:
        raise AudioError(f"ffmpeg mux timed out: {e}") from e
    if proc.returncode != 0 or not out.exists():
        raise AudioError(f"ffmpeg mux failed (exit {proc.returncode}): {proc.stderr[:500]}")
    return out
