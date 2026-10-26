"""GET /health — real dependency checks.

Returns 503 if any critical dependency is unreachable. This is what a Kubernetes liveness or
readiness probe wants: not 'is the process alive', but 'can I actually serve traffic'.
"""

from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter, Response

from app.config import get_settings
from app.models import CheckResult, HealthResponse

router = APIRouter()


def _check_binary(path: str, version_arg: str = "--version") -> CheckResult:
    binary = shutil.which(path) or (path if Path(path).exists() else None)
    if binary is None:
        return CheckResult(ok=False, detail=f"not found: {path}")
    try:
        out = subprocess.run(
            [binary, version_arg],
            capture_output=True, text=True, timeout=5,
        )
        version = (out.stdout.splitlines() or out.stderr.splitlines() or [""])[0].strip()
        return CheckResult(ok=True, version=version[:120])
    except (subprocess.TimeoutExpired, OSError) as e:
        return CheckResult(ok=False, detail=str(e))


def _check_latex() -> CheckResult:
    # LaTeX is optional — Manim works without it for non-MathTex scenes.
    latex = shutil.which("latex") or shutil.which("xelatex")
    if latex is None:
        return CheckResult(ok=False, detail="no latex/xelatex on PATH (MathTex scenes will fail)")
    return CheckResult(ok=True, version=Path(latex).name)


def _check_sandbox() -> CheckResult:
    settings = get_settings()
    if not settings.sandbox_enabled:
        return CheckResult(ok=True, tool="disabled", detail="SANDBOX_ENABLED=false — dev only")
    bwrap = shutil.which("bwrap")
    if bwrap is None:
        return CheckResult(ok=False, tool="bubblewrap", detail="bwrap binary missing")
    try:
        out = subprocess.run([bwrap, "--version"], capture_output=True, text=True, timeout=3)
        return CheckResult(ok=True, tool="bubblewrap", version=out.stdout.strip())
    except (subprocess.TimeoutExpired, OSError) as e:
        return CheckResult(ok=False, tool="bubblewrap", detail=str(e))


def _check_storage() -> CheckResult:
    from app.storage.selector import get_storage  # local import — avoids circular at load time
    settings = get_settings()
    try:
        t0 = time.perf_counter()
        store = get_storage(settings.storage_backend)
        ok, detail = store.health()
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return CheckResult(ok=ok, backend=settings.storage_backend, latency_ms=latency_ms, detail=detail)
    except Exception as e:
        return CheckResult(ok=False, backend=settings.storage_backend, detail=f"{type(e).__name__}: {e}")


def _check_disk() -> CheckResult:
    path = "/tmp"
    try:
        usage = shutil.disk_usage(path)
        free_mb = usage.free // (1024 * 1024)
        return CheckResult(ok=free_mb > 500, free_mb=free_mb)
    except OSError as e:
        return CheckResult(ok=False, detail=str(e))


def _check_semaphore() -> CheckResult:
    from app.core.semaphore import get_semaphore_state
    active, maximum = get_semaphore_state()
    return CheckResult(ok=True, active=active, max=maximum)


@router.get("/health", response_model=HealthResponse, tags=["observability"])
def health(response: Response) -> HealthResponse:
    settings = get_settings()
    checks = {
        "manim":     _check_binary(settings.manim_path, "--version"),
        "ffmpeg":    _check_binary(settings.ffmpeg_path, "-version"),
        "latex":     _check_latex(),
        "sandbox":   _check_sandbox(),
        "storage":   _check_storage(),
        "disk":      _check_disk(),
        "semaphore": _check_semaphore(),
    }

    # `latex` is advisory; everything else is critical
    critical_failures = [k for k, v in checks.items() if not v.ok and k != "latex"]
    advisory_failures = [k for k, v in checks.items() if not v.ok and k == "latex"]

    if critical_failures:
        status = "down"
        response.status_code = 503
    elif advisory_failures:
        status = "degraded"
    else:
        status = "ok"

    return HealthResponse(status=status, checks=checks)
