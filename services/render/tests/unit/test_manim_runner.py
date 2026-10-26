from __future__ import annotations

from pathlib import Path

import pytest

from app.core.manim_runner import build_invocation, resolve_artifact_on_host


@pytest.fixture
def defaults() -> dict:
    return dict(
        script_in_sandbox=Path("/work/animation.py"),
        scene_class="Hello",
        quality="low",
        video_format="mp4",
        backend="cairo",
        fps_override=None,
        resolution_override=None,
        transparent=False,
        background=None,
        frame_range=None,
        media_dir_in_sandbox=Path("/work/media"),
        manim_binary="/opt/venv/bin/manim",
    )


def test_low_quality_default_path(defaults: dict) -> None:
    inv = build_invocation(**defaults)
    assert inv.expected_output == Path("/work/media/videos/animation/480p15/Hello.mp4")
    assert inv.width == 854 and inv.height == 480 and inv.fps == 15
    assert "-ql" in inv.argv
    assert "Hello" in inv.argv[-1]


def test_resolution_and_fps_overrides_win(defaults: dict) -> None:
    defaults["resolution_override"] = (1920, 1080)
    defaults["fps_override"] = 24
    inv = build_invocation(**defaults)
    assert inv.width == 1920 and inv.height == 1080 and inv.fps == 24
    assert "--resolution" in inv.argv
    assert "1920,1080" in inv.argv


def test_png_goes_to_images_dir(defaults: dict) -> None:
    defaults["video_format"] = "png"
    inv = build_invocation(**defaults)
    assert inv.expected_output == Path("/work/media/images/animation/Hello.png")


def test_host_path_translation(defaults: dict) -> None:
    inv = build_invocation(**defaults)
    host = resolve_artifact_on_host(
        inv, host_media_dir=Path("/tmp/mrs-xyz/media"),
        sandbox_media_dir=Path("/work/media"),
    )
    assert host == Path("/tmp/mrs-xyz/media/videos/animation/480p15/Hello.mp4")


def test_frame_range_and_transparent_flags(defaults: dict) -> None:
    defaults["frame_range"] = (0, 4)
    defaults["transparent"] = True
    defaults["background"] = "#112233"
    inv = build_invocation(**defaults)
    assert "-t" in inv.argv
    assert "--background_color" in inv.argv and "#112233" in inv.argv
    assert "--from_animation_number" in inv.argv
