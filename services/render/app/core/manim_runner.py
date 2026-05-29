"""Build the Manim CLI invocation and discover the resulting artifact.

Manim's CLI grew organically and has a few sharp edges this module smooths over:
  - `-q` flags: `l/m/h/p/k` for low/medium/high/production/4k.
  - `--format`: mp4 by default, but png/svg for single-frame renders, gif for animations.
  - `--fps` overrides quality's implied fps.
  - `--resolution WxH` overrides quality's implied resolution.
  - Output location: `media/videos/<script_stem>/<quality_dir>/<SceneName>.<ext>` for video,
    `media/images/<script_stem>/<SceneName>.<ext>` for stills. The <quality_dir> is like
    `480p15` / `720p30` / `1080p60` / `1440p60` / `2160p60`.

We compute the expected output path deterministically instead of globbing — that way a
partial render that leaves stray junk files doesn't trick us into returning the wrong one.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.models import Quality, RenderBackend, VideoFormat

_QUALITY_FLAG: dict[Quality, str] = {
    "low": "-ql",
    "medium": "-qm",
    "high": "-qh",
    "production": "-qp",
    "fourk": "-qk",
}

# (width, height, fps) implied by each quality preset. Must match Manim's own defaults.
_QUALITY_DIMS: dict[Quality, tuple[int, int, int]] = {
    "low":        (854, 480, 15),
    "medium":     (1280, 720, 30),
    "high":       (1920, 1080, 60),
    "production": (2560, 1440, 60),
    "fourk":      (3840, 2160, 60),
}

_QUALITY_DIR: dict[Quality, str] = {
    "low":        "480p15",
    "medium":     "720p30",
    "high":       "1080p60",
    "production": "1440p60",
    "fourk":      "2160p60",
}

_STILL_FORMATS: frozenset[VideoFormat] = frozenset({"png", "svg"})

# In Manim 0.19+, gif and png output filenames include a version suffix
# (e.g. SceneName_ManimCE_v0.19.2.gif).  Video formats (mp4/webm/mov) do not.
_VERSION_SUFFIX_FORMATS: frozenset[VideoFormat] = frozenset({"png", "gif"})


@dataclass(frozen=True)
class ManimInvocation:
    """Everything the sandbox runner needs to actually execute manim."""
    argv: list[str]
    expected_output: Path      # exact path or glob-parent dir for version-suffixed formats
    expected_glob: str | None  # glob pattern relative to expected_output.parent, or None
    width: int
    height: int
    fps: int


def build_invocation(
    *,
    script_in_sandbox: Path,
    scene_class: str,
    quality: Quality,
    video_format: VideoFormat,
    backend: RenderBackend,
    fps_override: int | None,
    resolution_override: tuple[int, int] | None,
    transparent: bool,
    background: str | None,
    frame_range: tuple[int, int] | None,
    media_dir_in_sandbox: Path,
    manim_binary: str,
) -> ManimInvocation:
    width, height, fps = _QUALITY_DIMS[quality]
    if resolution_override is not None:
        width, height = resolution_override
    if fps_override is not None:
        fps = fps_override

    argv: list[str] = [
        manim_binary,
        _QUALITY_FLAG[quality],
        "--format", video_format,
        "--renderer", backend,
        "--media_dir", str(media_dir_in_sandbox),
        "--fps", str(fps),
        "--resolution", f"{width},{height}",
        "--disable_caching",  # single-use render, cache just pollutes /work
        "--verbosity", "WARNING",  # keep stdout short; errors still go to stderr
    ]
    if transparent:
        argv += ["-t"]
    if frame_range is not None:
        a, b = frame_range
        argv += ["--from_animation_number", str(a), "--upto_animation_number", str(b)]

    argv += [str(script_in_sandbox), scene_class]

    script_stem = script_in_sandbox.stem
    # Quality dir is derived from actual height + fps (not just the preset name) so that
    # fps/resolution overrides are reflected in the path manim actually writes to.
    quality_dir = f"{height}p{fps}"

    expected_glob: str | None = None
    if video_format in _STILL_FORMATS:
        dir_path = media_dir_in_sandbox / "images" / script_stem
        if video_format in _VERSION_SUFFIX_FORMATS:
            expected = dir_path / f"{scene_class}.{video_format}"  # placeholder
            expected_glob = f"{scene_class}*.{video_format}"
        else:
            expected = dir_path / f"{scene_class}.{video_format}"
    elif video_format in _VERSION_SUFFIX_FORMATS:
        dir_path = media_dir_in_sandbox / "videos" / script_stem / quality_dir
        expected = dir_path / f"{scene_class}.{video_format}"  # placeholder
        expected_glob = f"{scene_class}*.{video_format}"
    else:
        expected = (
            media_dir_in_sandbox / "videos" / script_stem /
            quality_dir / f"{scene_class}.{video_format}"
        )

    return ManimInvocation(
        argv=argv, expected_output=expected, expected_glob=expected_glob,
        width=width, height=height, fps=fps,
    )


def resolve_artifact_on_host(invocation: ManimInvocation, host_media_dir: Path,
                             sandbox_media_dir: Path) -> Path:
    """Translate the in-sandbox expected path to the host filesystem.

    For formats with a version-suffix (gif, png), globs for the actual file because
    Manim appends `_ManimCE_v{version}` to those filenames.
    """
    try:
        relative = invocation.expected_output.relative_to(sandbox_media_dir)
    except ValueError as e:
        raise RuntimeError(
            f"expected_output {invocation.expected_output} is not under sandbox media dir "
            f"{sandbox_media_dir}"
        ) from e
    host_dir = host_media_dir / relative.parent
    if invocation.expected_glob is not None:
        matches = sorted(host_dir.glob(invocation.expected_glob))
        if matches:
            return matches[0]
        # Return placeholder so the caller's existence check produces the right error message.
        return host_dir / invocation.expected_output.name
    return host_dir / relative.name
