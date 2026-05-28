"""Extract a single JPEG frame from a rendered video as its thumbnail.

Reasons for ffmpeg over imageio or PIL-based decoders:
  - ffmpeg is already installed (we need it for audio mux), no extra deps.
  - It handles every codec Manim can emit (h264, vp9, hevc, prores).
  - -ss before -i is a keyframe-seek — fast and precise enough for still frames.

Output is a temporary .jpg; caller uploads it and deletes the temp.
"""

from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.logging import get_logger

log = get_logger("thumbnail")


@dataclass(frozen=True)
class ThumbnailResult:
    path: Path
    width: int
    height: int


class ThumbnailError(RuntimeError):
    """ffmpeg couldn't extract a frame — treat as non-fatal, skip the thumbnail."""


def extract(video_path: Path, *, at_fraction: float = 0.5,
            duration_sec_hint: float | None = None,
            max_dimension: int = 720) -> ThumbnailResult:
    """Pull a frame `at_fraction` of the way through the video.

    If duration_sec_hint is None we probe the video with ffprobe first — one extra fork,
    but the alternative is seeking blind and risking an empty frame past EOF.
    """
    settings = get_settings()
    ffmpeg = settings.ffmpeg_path
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")

    duration = _probe_duration(ffprobe, video_path) if duration_sec_hint is None else duration_sec_hint
    seek = max(0.0, min(duration * at_fraction, max(duration - 0.05, 0.0)))

    out = Path(tempfile.mkstemp(prefix="thumb-", suffix=".jpg")[1])
    cmd = [
        ffmpeg, "-y", "-v", "error",
        "-ss", f"{seek:.3f}", "-i", str(video_path),
        "-frames:v", "1",
        "-vf", f"scale='min({max_dimension},iw)':'-2'",
        "-q:v", "3",
        str(out),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired as e:
        raise ThumbnailError(f"ffmpeg timed out: {e}") from e
    if proc.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        raise ThumbnailError(f"ffmpeg exit {proc.returncode}: {proc.stderr[:500]}")

    w, h = _probe_dimensions(ffprobe, out)
    return ThumbnailResult(path=out, width=w, height=h)


def _probe_duration(ffprobe: str, path: Path) -> float:
    cmd = [
        ffprobe, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return float(proc.stdout.strip() or 0.0)
    except (subprocess.TimeoutExpired, ValueError):
        return 0.0


def probe_duration(path: Path) -> float:
    """Public: measure a media file's duration in seconds via ffprobe.

    Returns 0.0 on any failure (best-effort; callers treat 0 as 'unknown').
    """
    settings = get_settings()
    ffprobe = settings.ffmpeg_path.replace("ffmpeg", "ffprobe")
    return _probe_duration(ffprobe, path)


def _probe_dimensions(ffprobe: str, path: Path) -> tuple[int, int]:
    cmd = [
        ffprobe, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0", str(path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        w, h = proc.stdout.strip().split("x")
        return int(w), int(h)
    except (subprocess.TimeoutExpired, ValueError):
        return 0, 0
