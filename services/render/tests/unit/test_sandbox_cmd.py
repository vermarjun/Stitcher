"""The bwrap command line and rlimits. No bwrap needed: we only build the argv."""

from __future__ import annotations

import os
import resource
from pathlib import Path

import pytest

from app.config import reset_settings_for_testing
from app.core.sandbox import Sandbox, SandboxLimits, _apply_rlimits

LIMITS = SandboxLimits(timeout_sec=10, memory_mb=512, cpu_count=1.0)


def _sandbox_with_fake_bwrap(monkeypatch: pytest.MonkeyPatch) -> Sandbox:
    monkeypatch.setenv("SANDBOX_ENABLED", "true")
    reset_settings_for_testing()
    monkeypatch.setattr("app.core.sandbox.shutil.which", lambda _name: "/usr/bin/bwrap")
    return Sandbox()


def test_command_has_no_seccomp_flag(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    cmd = _sandbox_with_fake_bwrap(monkeypatch)._build_cmd(tmp_path, "Scene", LIMITS)
    assert "--seccomp" not in cmd


def test_command_isolates_and_drops_caps(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    cmd = _sandbox_with_fake_bwrap(monkeypatch)._build_cmd(tmp_path, "Scene", LIMITS)
    assert "--unshare-all" in cmd
    assert cmd[cmd.index("--cap-drop") + 1] == "ALL"
    assert cmd[cmd.index("--bind") + 1 : cmd.index("--bind") + 3] == [str(tmp_path), "/work"]


def test_rlimits_cover_memory_and_files(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[int, tuple[int, int]] = {}
    monkeypatch.setattr(resource, "setrlimit", lambda which, val: calls.__setitem__(which, val))
    _apply_rlimits(LIMITS)()
    mem = 512 * 1024 * 1024
    assert calls[resource.RLIMIT_DATA] == (mem, mem)
    assert calls[resource.RLIMIT_NOFILE] == (1024, 1024)
    assert calls[resource.RLIMIT_CORE] == (0, 0)
    assert calls[resource.RLIMIT_NPROC] == (256, 256)
    cpu = 10 * max(os.cpu_count() or 1, 1) + 5
    assert calls[resource.RLIMIT_CPU] == (cpu, cpu)


def test_blas_threads_capped(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    cmd = _sandbox_with_fake_bwrap(monkeypatch)._build_cmd(tmp_path, "Scene", LIMITS)
    i = cmd.index("OPENBLAS_NUM_THREADS")
    assert cmd[i - 1] == "--setenv" and cmd[i + 1] == "2"
