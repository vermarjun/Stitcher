"""Sandbox escape battery — each fixture MUST fail safely under bwrap.

These tests are the one thing that genuinely proves the sandbox works. Everything else is
well-meaning configuration. If any of these pass (i.e. the fixture reports ESCAPE or the
host's resource usage spikes), the deployment is not safe to accept public traffic.

Run under `pytest -m security` on a Linux host with bwrap. CI runs this gate before any
release tag — see .github/workflows/ci.yml.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.sandbox import Sandbox, SandboxLimits

pytestmark = pytest.mark.security

FIXTURES = Path(__file__).parent / "fixtures"
TIGHT = SandboxLimits(timeout_sec=5, memory_mb=256, cpu_count=1.0)


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


@pytest.mark.asyncio
async def test_network_is_isolated() -> None:
    r = await Sandbox().run(_read("net_exfil.py"), "NetExfil", TIGHT)
    assert r.exit_code != 0, "network fixture exited clean — sandbox is letting traffic out"
    assert "ESCAPE" not in r.stdout
    assert any(kw in r.stderr for kw in ("Network is unreachable", "getaddrinfo", "EPERM", "errno"))


@pytest.mark.asyncio
async def test_filesystem_is_confined() -> None:
    r = await Sandbox().run(_read("fs_escape.py"), "FsEscape", TIGHT)
    assert r.exit_code != 0
    assert "ESCAPE" not in r.stdout
    # Either EPERM (no bind) or FileNotFoundError (path never entered the mount ns).
    assert any(kw in r.stderr for kw in ("Permission denied", "No such file", "Read-only"))


@pytest.mark.asyncio
async def test_fork_bomb_is_capped() -> None:
    r = await Sandbox().run(_read("fork_bomb.py"), "ForkBomb", TIGHT)
    # May exit cleanly (loop broke on EAGAIN) or be killed by timeout — but must terminate.
    assert r.duration_ms < 10_000, "fork bomb ran past wall clock — PID cap not holding"


@pytest.mark.asyncio
async def test_memory_bomb_is_oom_killed() -> None:
    r = await Sandbox().run(_read("memory_bomb.py"), "MemBomb", TIGHT)
    assert r.killed_by in {"oom", "signal", "timeout"}
    assert r.exit_code != 0


@pytest.mark.asyncio
async def test_wallclock_timeout_fires() -> None:
    r = await Sandbox().run(_read("slow_infinite_loop.py"), "SlowLoop", TIGHT)
    assert r.killed_by == "timeout"
    assert r.duration_ms < 10_000
