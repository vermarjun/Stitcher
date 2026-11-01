"""Bubblewrap sandbox — run untrusted Manim code with namespaces + rlimits.

Threat model: the code we execute is arbitrary Python written (or pasted) by someone we don't
trust. We assume it may try to read /etc/passwd, fork forever, eat all memory, exfiltrate data,
or write to random paths. We do NOT assume a kernel 0-day — if the attacker has one, no
userspace sandbox saves us.

Defences (layered, each one cheap):
  1. Filesystem: --unshare-all gives a fresh mount namespace; we bind /usr, /etc, /lib, /opt
     and /var/lib/texmf read-only, a fresh tmpfs /tmp, and a per-job host directory
     read-write at /work. No /home, no /root.
  2. Network: --unshare-net drops the net namespace entirely. No sockets resolve.
  3. PIDs: --unshare-pid; process sees itself as PID 1, can't signal the host.
  4. UID: --uid 99999 --gid 99999 — a user that doesn't exist on the host. All capabilities dropped.
  5. Resources: setrlimit() applied in the child before it execs bwrap, so the limits are
     inherited by everything inside the sandbox: CPU time, file size, core dumps, open files,
     and data segment size (the memory cap).
  6. Wall-clock: asyncio.wait_for — if bwrap itself hangs, we kill the whole process group.

There is NO seccomp filter. The policy in app/assets and scripts/build_seccomp.py are not wired in.

If bwrap isn't available (macOS dev, CI without --privileged) we fall back to a no-sandbox
subprocess when SANDBOX_ENABLED=false — the config layer refuses this in prod.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import resource
import shutil
import signal
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.config import get_settings
from app.core.voiceover import stage_voiceover_bundle
from app.logging import get_logger
from app.models import VoiceoverSpec

log = get_logger("sandbox")

KilledBy = Literal["timeout", "oom", "signal", "exit", "startup"]


@dataclass(frozen=True)
class SandboxLimits:
    """Per-invocation caps. Pipeline fills these from the request, clamped against config."""
    timeout_sec: int
    memory_mb: int
    cpu_count: float
    max_output_bytes: int = 10 * 1024 * 1024  # 10 MB of stdout+stderr is already absurd


@dataclass
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    killed_by: KilledBy
    # The workdir is returned so the pipeline can scavenge artifacts (media/, *.mp4) before
    # cleanup. Caller owns deletion.
    workdir: Path


class Sandbox:
    """Stateless — construct once per process, call .run() per job.

    Why not a context manager: the workdir lifecycle belongs to the pipeline, which needs to
    pull rendered files out AFTER the sandbox exits but BEFORE the dir is destroyed.
    """

    def __init__(self) -> None:
        s = get_settings()
        self.enabled = s.sandbox_enabled
        self.bwrap = shutil.which("bwrap")
        self.python = s.python_path  # inside-sandbox interpreter path
        if self.enabled and self.bwrap is None:
            raise RuntimeError(
                "SANDBOX_ENABLED=true but bwrap binary not found on PATH. "
                "Install bubblewrap or set SANDBOX_ENABLED=false (dev only)."
            )

    async def run(self, code: str, scene_class: str, limits: SandboxLimits,
                  manim_argv: list[str] | None = None,
                  voiceover: VoiceoverSpec | None = None) -> SandboxResult:
        workdir = Path(tempfile.mkdtemp(prefix="mrs-", dir="/tmp"))
        script = workdir / "animation.py"
        script.write_text(code, encoding="utf-8")
        (workdir / "media").mkdir(exist_ok=True)

        # Stage native-voiceover clips into <workdir>/media/voiceovers/<key>.mp3 so
        # OfflineTTS() finds them at <media_dir>/voiceovers. Done on the host before
        # the sandbox launches — the sandbox stays fully offline. A malformed bundle
        # raises before manim is invoked; the pipeline turns it into a structured error.
        staged = stage_voiceover_bundle(workdir, voiceover)
        if staged:
            log.debug("sandbox.voiceover_staged", count=staged, workdir=str(workdir))

        cmd = self._build_cmd(workdir, scene_class, limits, manim_argv=manim_argv)
        log.debug("sandbox.exec", cmd=cmd, workdir=str(workdir), limits=limits.__dict__)

        t0 = time.perf_counter()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,  # own process group so we can SIGKILL the tree
                preexec_fn=_apply_rlimits(limits),
            )
        except (OSError, FileNotFoundError) as e:
            return SandboxResult(
                exit_code=-1, stdout="", stderr=f"sandbox failed to start: {e}",
                duration_ms=int((time.perf_counter() - t0) * 1000),
                killed_by="startup", workdir=workdir,
            )

        killed_by: KilledBy = "exit"
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=limits.timeout_sec + 2,
            )
        except TimeoutError:
            killed_by = "timeout"
            _kill_tree(proc.pid)
            stdout_b, stderr_b = await proc.communicate()
        duration_ms = int((time.perf_counter() - t0) * 1000)

        stdout = _truncate(stdout_b, limits.max_output_bytes)
        stderr = _truncate(stderr_b, limits.max_output_bytes)

        # Linux convention: -SIGKILL when we kill, 137 when OOM killer fired, 152 for SIGXCPU
        exit_code = proc.returncode if proc.returncode is not None else -1
        if killed_by == "exit":
            if exit_code == 137 or "Killed" in stderr:
                killed_by = "oom"
            elif exit_code < 0:
                killed_by = "signal"

        return SandboxResult(
            exit_code=exit_code, stdout=stdout, stderr=stderr,
            duration_ms=duration_ms, killed_by=killed_by, workdir=workdir,
        )

    def _build_cmd(self, workdir: Path, scene_class: str, limits: SandboxLimits,
                   manim_argv: list[str] | None = None) -> list[str]:
        settings = get_settings()
        if manim_argv is not None:
            inner = list(manim_argv)
        else:
            inner = [
                settings.manim_path, "-ql",
                str(Path("/work") / "animation.py"), scene_class,
                "--media_dir", "/work/media",
            ]
        if not self.enabled:
            # Unsandboxed fallback — dev only. Translate in-sandbox paths to host paths.
            sandbox_script = str(Path("/work") / "animation.py")
            sandbox_media = str(Path("/work") / "media")
            host_script = str(workdir / "animation.py")
            host_media = str(workdir / "media")
            return [
                arg.replace(sandbox_script, host_script).replace(sandbox_media, host_media)
                for arg in inner
            ]

        assert self.bwrap is not None
        bwrap_args: list[str] = [
            self.bwrap,
            "--unshare-all",
            "--die-with-parent",
            "--uid", "99999", "--gid", "99999",
            "--hostname", "sandbox",
            "--proc", "/proc",
            "--dev", "/dev",
            "--tmpfs", "/tmp",
            "--ro-bind", "/usr", "/usr",
            "--ro-bind", "/etc", "/etc",
            "--ro-bind", "/lib", "/lib",
            "--symlink", "usr/bin", "/bin",
            "--symlink", "usr/sbin", "/sbin",
            "--symlink", "usr/lib64", "/lib64",
            "--ro-bind", "/opt", "/opt",
            "--ro-bind", "/var/lib/texmf", "/var/lib/texmf",
            "--bind", str(workdir), "/work",
            "--chdir", "/work",
            "--setenv", "HOME", "/work",
            "--setenv", "PATH", "/opt/venv/bin:/usr/bin:/bin",
            "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
            "--cap-drop", "ALL",
            "--new-session",
        ]
        return [*bwrap_args, "--", *inner]


def _apply_rlimits(limits: SandboxLimits):
    """preexec_fn: apply rlimits in the child before it execs bwrap (or manim, unsandboxed).

    rlimits survive exec and are inherited by every process inside the sandbox, so the same
    caps hold in both modes. Each process gets its own copy of the limit; none of them is an
    aggregate across the sandbox.
    """
    def _inner() -> None:
        # Backstop only: the most CPU time a process could burn inside the wall-clock limit
        # (every host core busy), so multi-threaded renders are never cut off early.
        cpu_sec = int(limits.timeout_sec * max(limits.cpu_count, os.cpu_count() or 1, 1.0)) + 5
        mem = limits.memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec))
        resource.setrlimit(resource.RLIMIT_FSIZE, (512 * 1024 * 1024, 512 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, 1024))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        # Memory cap. RLIMIT_DATA counts heap and private writable mappings (what a memory
        # bomb allocates), per process. RLIMIT_AS is NOT used: Python + ffmpeg + Cairo map
        # several GB of virtual space at low physical usage, so any AS cap kills the ffmpeg
        # gif-combining step. Needs Linux >= 4.7 to cover mmap; on macOS it is best effort.
        with contextlib.suppress(ValueError, OSError):
            resource.setrlimit(resource.RLIMIT_DATA, (mem, mem))
        # RLIMIT_NPROC is deliberately not set: it is counted per user, not per sandbox, so a
        # cap here would also throttle the API process and concurrent renders. Process count
        # is bounded by the PID namespace and the wall-clock kill instead.
    return _inner


def _kill_tree(pid: int) -> None:
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(os.getpgid(pid), signal.SIGKILL)


def _truncate(b: bytes, cap: int) -> str:
    if len(b) <= cap:
        return b.decode("utf-8", errors="replace")
    head = b[: cap // 2].decode("utf-8", errors="replace")
    tail = b[-cap // 2:].decode("utf-8", errors="replace")
    return f"{head}\n...[truncated {len(b) - cap} bytes]...\n{tail}"
