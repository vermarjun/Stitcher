"""Saturation behaviour — the one guarantee callers build retries against.

We don't spin up real Manim here. Instead we monkeypatch `pipeline.run` with a slow stub
so the semaphore is the only thing under test. A real concurrency test with Manim would
take minutes and mostly measure ffmpeg.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.config import reset_settings_for_testing
from app.core import semaphore as sem_mod
from app.main import create_app
from app.models import ExecutionInfo, RenderOutput, RenderSuccessResponse


@pytest.fixture
def reject_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("MAX_CONCURRENT_RENDERS", "2")
    monkeypatch.setenv("QUEUE_FULL_POLICY", "reject")
    reset_settings_for_testing()
    sem_mod.reset_for_testing()

    async def slow_run(req):
        await asyncio.sleep(0.5)
        return RenderSuccessResponse(
            render=RenderOutput(
                url="file:///fake", thumbnailUrl=None, format="mp4",
                durationSec=1.0, width=854, height=480, fps=15,
                bytes=100, hasAudio=False,
            ),
            execution=ExecutionInfo(totalMs=500),
            meta={},
        )

    monkeypatch.setattr("app.api.render.run", slow_run)
    return TestClient(create_app())


def _payload() -> dict:
    return {"code": "x=1", "sceneClass": "Hello"}


def _headers() -> dict:
    return {"x-api-key": "test-key-at-least-sixteen-chars"}


def test_third_request_gets_503(reject_client: TestClient) -> None:
    import threading

    results: list[int] = []

    def fire() -> None:
        r = reject_client.post("/render", headers=_headers(), json=_payload())
        results.append(r.status_code)

    threads = [threading.Thread(target=fire) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # With max=2 and 4 concurrent fire-and-forget requests, at least one should 503.
    assert 503 in results, f"expected at least one 503, got {results}"
    assert results.count(200) >= 2


def test_503_carries_retry_after(reject_client: TestClient) -> None:
    import threading

    responses: list = []

    def fire() -> None:
        responses.append(reject_client.post("/render", headers=_headers(), json=_payload()))

    threads = [threading.Thread(target=fire) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    failures = [r for r in responses if r.status_code == 503]
    assert failures, "need at least one saturated response to assert against"
    assert failures[0].headers.get("Retry-After")
