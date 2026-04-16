"""Concurrency gate. The ONE thing that keeps the service from melting under load.

Design:
  - Single process-wide asyncio.Semaphore with value = `max_concurrent_renders`.
  - Two acquire policies, both correct for different deployments:
      * "reject" (default): if full, raise SaturatedError immediately → caller gets 503.
      * "block": wait up to `queue_wait_timeout_sec`, then raise if still full.
  - Expose (active, max) for /health so ops can see saturation without scraping metrics.

Why not a thread pool / process pool / queue with persistence?
  - Render work is CPU-bound inside a subprocess, so an async semaphore gating the number
    of concurrent subprocesses is exactly the right shape.
  - Any persistence layer (Redis, disk queue) belongs in the CALLER — the render service
    is explicitly stateless. If the process dies mid-render, the job is lost; the caller
    must retry. This is documented in README and matters when configuring k8s replicas.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.config import get_settings
from app.core import metrics as m


class SaturatedError(RuntimeError):
    """All render slots are in use. Caller should back off."""
    def __init__(self, active: int, maximum: int, retry_after_sec: int) -> None:
        super().__init__(f"{active}/{maximum} slots in use")
        self.active = active
        self.maximum = maximum
        self.retry_after_sec = retry_after_sec


_sem: asyncio.Semaphore | None = None
_active: int = 0
_max: int = 0


def _get_sem() -> asyncio.Semaphore:
    global _sem, _max
    if _sem is None:
        s = get_settings()
        _max = s.max_concurrent_renders
        _sem = asyncio.Semaphore(_max)
    return _sem


def get_semaphore_state() -> tuple[int, int]:
    """Read-only view of (active, max). Safe to call from any coroutine."""
    _get_sem()
    return _active, _max


def reset_for_testing() -> None:
    global _sem, _active, _max
    _sem = None
    _active = 0
    _max = 0


@asynccontextmanager
async def acquire() -> AsyncIterator[None]:
    global _active
    settings = get_settings()
    sem = _get_sem()

    if settings.queue_full_policy == "reject":
        if sem.locked() and _active >= _max:
            # Be honest about the retry budget — caller uses this to set Retry-After.
            m.saturated.inc()
            raise SaturatedError(_active, _max, retry_after_sec=5)
        await sem.acquire()
    else:
        try:
            await asyncio.wait_for(sem.acquire(), timeout=settings.queue_wait_timeout_sec)
        except TimeoutError as e:
            raise SaturatedError(_active, _max,
                                 retry_after_sec=settings.queue_wait_timeout_sec) from e

    _active += 1
    m.active.set(_active)
    try:
        yield
    finally:
        _active -= 1
        m.active.set(_active)
        sem.release()
