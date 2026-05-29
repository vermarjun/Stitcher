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
# manim + numpy + cairo need ~500MB just to import cleanly on Debian.
# 256MB trips OpenBLAS before construct() ever runs, which masks what we're testing.
TIGHT = SandboxLimits(timeout_sec=8, memory_mb=768, cpu_count=1.0)
# Memory-bomb test uses a tighter cap so RLIMIT_AS actually fires on the payload.
MEM_TIGHT = SandboxLimits(timeout_sec=8, memory_mb=384, cpu_count=1.0)


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


_NET_BLOCK_SIGNS = (
    "Network is unreachable", "getaddrinfo", "Name or service not known",
    "EPERM", "errno", "net-blocked", "Temporary failure", "Connection refused",
)
_FS_BLOCK_SIGNS = (
    "Permission denied", "No such file", "Read-only", "fs-blocked",
)
_OOM_SIGNS = (
    "MemoryError", "Killed", "Cannot allocate memory", "OpenBLAS",
    "out of memory", "Out of memory",
)


@pytest.mark.asyncio
async def test_network_is_isolated() -> None:
    r = await Sandbox().run(_read("net_exfil.py"), "NetExfil", TIGHT)
    assert r.exit_code != 0, "network fixture exited clean — sandbox is letting traffic out"
    assert "ESCAPE" not in r.stdout
    assert any(kw in r.stderr for kw in _NET_BLOCK_SIGNS), (
        f"no network-block signature in stderr: {r.stderr[-500:]!r}"
    )


@pytest.mark.asyncio
async def test_filesystem_is_confined() -> None:
    r = await Sandbox().run(_read("fs_escape.py"), "FsEscape", TIGHT)
    assert r.exit_code != 0
    assert "ESCAPE" not in r.stdout
    assert any(kw in r.stderr for kw in _FS_BLOCK_SIGNS), (
        f"no fs-block signature in stderr: {r.stderr[-500:]!r}"
    )


@pytest.mark.asyncio
async def test_fork_bomb_is_capped() -> None:
    r = await Sandbox().run(_read("fork_bomb.py"), "ForkBomb", TIGHT)
    # May exit cleanly (loop broke on EAGAIN) or be killed by timeout — but must terminate.
    assert r.duration_ms < 12_000, "fork bomb ran past wall clock — PID cap not holding"


@pytest.mark.asyncio
async def test_memory_bomb_is_oom_killed() -> None:
    r = await Sandbox().run(_read("memory_bomb.py"), "MemBomb", MEM_TIGHT)
    assert r.exit_code != 0
    # RLIMIT_AS can surface as: OS OOM kill (killed_by=oom), a Python MemoryError
    # (killed_by=exit but exit!=0), or a timeout if allocation thrashes long enough.
    # All three are acceptable — what matters is that the host wasn't touched.
    if r.killed_by in {"oom", "signal", "timeout"}:
        return
    assert r.killed_by == "exit"
    assert any(kw in r.stderr for kw in _OOM_SIGNS), (
        f"mem-bomb exited non-zero but no OOM/alloc-failure signature: {r.stderr[-500:]!r}"
    )


@pytest.mark.asyncio
async def test_wallclock_timeout_fires() -> None:
    r = await Sandbox().run(_read("slow_infinite_loop.py"), "SlowLoop", TIGHT)
    assert r.killed_by == "timeout", (
        f"expected timeout, got killed_by={r.killed_by} exit={r.exit_code} "
        f"dur={r.duration_ms}ms stderr={r.stderr[-500:]!r}"
    )
    assert r.duration_ms < 12_000
