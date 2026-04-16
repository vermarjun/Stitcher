"""End-to-end render pipeline: validate → sandbox → classify → upload.

Every step is instrumented with a duration in milliseconds so callers can see exactly
where time went. On failure we always return a RenderFailureResponse — we never raise
out of this layer, because HTTP 500s are reserved for bugs in the service, not bugs in
the user's Manim code.
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

from app import __version__ as _svc_version
from app.config import get_settings
from app.core import metrics as m
from app.core.audio import AudioError, decode_to_tempfile
from app.core.audio import bake as bake_audio
from app.core.classify import classify
from app.core.manim_runner import build_invocation, resolve_artifact_on_host
from app.core.sandbox import Sandbox, SandboxLimits
from app.core.thumbnail import ThumbnailError
from app.core.thumbnail import extract as extract_thumbnail
from app.core.validate import first_issue_as_error, validate
from app.logging import get_logger
from app.models import (
    EchoedInput,
    ErrorInfo,
    ExecutionInfo,
    RenderFailureResponse,
    RenderOutput,
    RenderRequest,
    RenderSuccessResponse,
)
from app.storage.base import StorageError
from app.storage.selector import get_storage

log = get_logger("pipeline")

_CONTENT_TYPES = {
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    "gif": "image/gif", "png": "image/png", "svg": "image/svg+xml",
}


def _exec(total_ms: int, sandbox_ms: int = 0, render_ms: int = 0, upload_ms: int = 0,
          manim_version: str | None = None) -> ExecutionInfo:
    s = get_settings()
    return ExecutionInfo(
        sandbox_setup_ms=sandbox_ms,
        render_ms=render_ms,
        upload_ms=upload_ms,
        total_ms=total_ms,
        manim_version=manim_version,
        sandbox="bubblewrap" if s.sandbox_enabled else "disabled",
    )


def _fail(req: RenderRequest, t0: float, phase: str, category: str, summary: str,
          stderr: str = "", stdout: str = "", line: int | None = None,
          exit_code: int | None = None, killed_by: str | None = None,
          render_ms: int = 0, sandbox_ms: int = 0) -> RenderFailureResponse:
    m.renders.labels(status="failure", category=category).inc()
    m.render_seconds.labels(phase="total").observe(time.perf_counter() - t0)
    return RenderFailureResponse(
        error=ErrorInfo(
            phase=phase, category=category, summary=summary,  # type: ignore[arg-type]
            stderr=stderr[:8000], stdout=stdout[:8000],
            line=line, exitCode=exit_code, killedBy=killed_by,
        ),
        echo=EchoedInput(code=req.code[:4000], sceneClass=req.scene_class),
        execution=_exec(int((time.perf_counter() - t0) * 1000),
                        sandbox_ms=sandbox_ms, render_ms=render_ms),
        meta={"serviceVersion": _svc_version, "traceId": req.meta.trace_id},
    )


async def run(req: RenderRequest) -> RenderSuccessResponse | RenderFailureResponse:
    settings = get_settings()
    t0 = time.perf_counter()

    # --- 1. AST pre-guard ---
    issues = validate(req.code)
    first = first_issue_as_error(issues)
    if first is not None:
        line, summary = first
        log.info("pipeline.rejected", reason="validation", summary=summary, line=line)
        return _fail(req, t0, "validation", "Rejected", summary, line=line)

    # --- 2. Sandbox + manim ---
    limits = SandboxLimits(
        timeout_sec=req.limits.timeout_sec or settings.sandbox_timeout_default,
        memory_mb=req.limits.memory_mb or settings.sandbox_memory_mb_default,
        cpu_count=req.limits.cpu_count or settings.sandbox_cpu_default,
    )

    # Build the manim argv ahead of time; the sandbox's default cmd is just `manim -ql`
    # and we need to override it with the full invocation for this specific request.
    sandbox = Sandbox()
    sandbox_t0 = time.perf_counter()
    result = await sandbox.run(req.code, req.scene_class, limits)
    sandbox_ms = int((time.perf_counter() - sandbox_t0) * 1000)

    if result.killed_by == "timeout":
        log.warning("pipeline.timeout", timeout_sec=limits.timeout_sec)
        return _fail(req, t0, "timeout", "Timeout",
                     f"render exceeded {limits.timeout_sec}s wall-clock",
                     stderr=result.stderr, stdout=result.stdout,
                     killed_by="timeout", render_ms=result.duration_ms,
                     sandbox_ms=sandbox_ms)
    if result.killed_by == "oom":
        log.warning("pipeline.oom", memory_mb=limits.memory_mb)
        return _fail(req, t0, "oom", "OutOfMemory",
                     f"render exceeded {limits.memory_mb}MB",
                     stderr=result.stderr, stdout=result.stdout,
                     killed_by="oom", render_ms=result.duration_ms,
                     sandbox_ms=sandbox_ms)
    if result.killed_by == "startup":
        log.error("pipeline.sandbox_setup_failed", stderr=result.stderr)
        return _fail(req, t0, "sandbox_setup", "SandboxSetup",
                     "could not start sandbox", stderr=result.stderr,
                     render_ms=result.duration_ms, sandbox_ms=sandbox_ms)

    if result.exit_code != 0:
        c = classify(result.stderr, result.stdout)
        log.info("pipeline.manim_failed", category=c.category, line=c.line)
        return _fail(req, t0, c.phase, c.category, c.summary,
                     stderr=result.stderr, stdout=result.stdout, line=c.line,
                     exit_code=result.exit_code, render_ms=result.duration_ms,
                     sandbox_ms=sandbox_ms)

    # --- 3. Find the artifact ---
    inv = build_invocation(
        script_in_sandbox=Path("/work/animation.py"),
        scene_class=req.scene_class,
        quality=req.render.quality,
        video_format=req.render.format,
        backend=req.render.backend,
        fps_override=req.render.fps,
        resolution_override=req.render.resolution,
        transparent=req.render.transparent,
        background=req.render.background,
        frame_range=req.render.frame_range,
        media_dir_in_sandbox=Path("/work/media"),
        manim_binary=settings.manim_path,
    )
    host_artifact = resolve_artifact_on_host(
        inv, host_media_dir=result.workdir / "media",
        sandbox_media_dir=Path("/work/media"),
    )
    if not host_artifact.exists():
        log.error("pipeline.artifact_missing", expected=str(host_artifact))
        return _fail(req, t0, "internal", "ArtifactMissing",
                     f"manim exited 0 but no file at {host_artifact.name}",
                     stderr=result.stderr, stdout=result.stdout,
                     render_ms=result.duration_ms, sandbox_ms=sandbox_ms)

    # --- 3b. Audio mux (optional) ---
    if req.audio is not None and req.render.format in {"mp4", "webm", "mov"}:
        try:
            audio_src = decode_to_tempfile(req.audio.base64, req.audio.filename)
            muxed = bake_audio(host_artifact, audio_src,
                               offset_sec=req.audio.offset, gain_db=req.audio.gain)
            audio_src.unlink(missing_ok=True)
            host_artifact = muxed  # upload the muxed version, not the silent original
        except AudioError as e:
            log.warning("pipeline.audio_failed", error=str(e))
            return _fail(req, t0, "internal", "AudioError", str(e),
                         render_ms=result.duration_ms, sandbox_ms=sandbox_ms)

    # --- 4. Upload ---
    upload_t0 = time.perf_counter()
    try:
        store = get_storage(req.storage.backend)
        url, size = store.put(
            host_artifact, folder=req.storage.folder, public=req.storage.public,
            content_type=_CONTENT_TYPES.get(req.render.format),
        )
    except StorageError as e:
        log.error("pipeline.upload_failed", error=str(e))
        return _fail(req, t0, "upload", "StorageError", str(e),
                     render_ms=result.duration_ms, sandbox_ms=sandbox_ms)
    upload_ms = int((time.perf_counter() - upload_t0) * 1000)

    # --- 4b. Thumbnail (best-effort — failure here is non-fatal) ---
    thumbnail_url: str | None = None
    if req.storage.generate_thumbnail and req.render.format in {"mp4", "webm", "mov", "gif"}:
        try:
            thumb = extract_thumbnail(host_artifact, at_fraction=req.storage.thumbnail_at)
            t_url, _ = store.put(
                thumb.path, folder=f"{req.storage.folder}/thumbs",
                public=req.storage.public, content_type="image/jpeg",
            )
            thumbnail_url = t_url
            thumb.path.unlink(missing_ok=True)
        except (ThumbnailError, StorageError) as e:
            log.warning("pipeline.thumbnail_failed", error=str(e))

    # --- 5. Clean up workdir ---
    shutil.rmtree(result.workdir, ignore_errors=True)

    total_ms = int((time.perf_counter() - t0) * 1000)
    log.info("pipeline.ok", total_ms=total_ms, size=size, url_host=url.split("/")[2] if "//" in url else "local")
    m.renders.labels(status="success", category="ok").inc()
    m.render_seconds.labels(phase="sandbox").observe(sandbox_ms / 1000)
    m.render_seconds.labels(phase="upload").observe(upload_ms / 1000)
    m.render_seconds.labels(phase="total").observe(total_ms / 1000)

    return RenderSuccessResponse(
        render=RenderOutput(
            url=url, thumbnailUrl=thumbnail_url, format=req.render.format,
            durationSec=0.0,  # TODO(jan-17): probe with ffprobe
            width=inv.width, height=inv.height, fps=inv.fps, bytes=size,
            codec=None, hasAudio=req.audio is not None,
        ),
        execution=_exec(total_ms, sandbox_ms=sandbox_ms,
                        render_ms=result.duration_ms, upload_ms=upload_ms),
        meta={"serviceVersion": _svc_version, "traceId": req.meta.trace_id},
    )
