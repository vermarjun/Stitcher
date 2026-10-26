"""GET /capabilities — what this deployment can actually do.

Callers use this to check that the features they need (MathTex = latex, opengl backend = opengl,
cloudinary storage = [cloudinary] extra installed) are present before sending work.
"""

from __future__ import annotations

import shutil
import subprocess

from fastapi import APIRouter

from app.config import get_settings
from app.models import CapabilitiesResponse, Limits

router = APIRouter()


def _tool_version(path: str, arg: str = "--version") -> str | None:
    binary = shutil.which(path)
    if not binary:
        return None
    try:
        out = subprocess.run([binary, arg], capture_output=True, text=True, timeout=3)
        first_line = (out.stdout.splitlines() or out.stderr.splitlines() or [""])[0]
        return first_line.strip()[:120] or None
    except (subprocess.TimeoutExpired, OSError):
        return None


def _detect_installed_storage_backends() -> list[str]:
    """Only report backends whose SDKs are actually installed."""
    installed: list[str] = ["local"]  # always available
    for name, module in (
        ("cloudinary", "cloudinary"),
        ("s3", "boto3"),
        ("gcs", "google.cloud.storage"),
        ("azure", "azure.storage.blob"),
    ):
        try:
            __import__(module)
            installed.append(name)
        except ImportError:
            continue
    return installed


@router.get("/capabilities", response_model=CapabilitiesResponse, tags=["observability"])
def capabilities() -> CapabilitiesResponse:
    settings = get_settings()
    return CapabilitiesResponse(
        manim_version=_tool_version(settings.manim_path, "--version"),
        ffmpeg_version=_tool_version(settings.ffmpeg_path, "-version"),
        latex_available=shutil.which("latex") is not None or shutil.which("xelatex") is not None,
        backends=["cairo", "opengl"],
        qualities=["low", "medium", "high", "production", "fourk"],
        formats=["mp4", "webm", "mov", "gif", "png", "svg"],
        storage=_detect_installed_storage_backends(),  # type: ignore[arg-type]
        sandbox="bubblewrap" if settings.sandbox_enabled else "disabled",
        max_concurrent=settings.max_concurrent_renders,
        limits=Limits(
            maxCodeBytes=settings.max_code_bytes,
            maxAudioBytes=settings.max_audio_bytes,
            maxTimeoutSec=settings.max_timeout_sec,
        ),
    )


@router.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {
        "service": "manim-render-service",
        "docs": "/docs",
        "health": "/health",
        "capabilities": "/capabilities",
    }
