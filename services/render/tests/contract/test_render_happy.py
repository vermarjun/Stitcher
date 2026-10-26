"""POST /render happy path — asserts the API contract the backend code depends on.

Requires `manim` and `ffmpeg` on PATH, so this is marked `contract` and auto-skipped
when those aren't present (e.g. on a bare dev shell without the render deps installed).
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

pytestmark = pytest.mark.contract

_SKIP_REASON = "manim or ffmpeg missing from PATH"
_MISSING = shutil.which("manim") is None or shutil.which("ffmpeg") is None


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture
def hello_code() -> str:
    return (Path(__file__).parent.parent / "fixtures" / "manim" / "hello.py").read_text()


@pytest.mark.skipif(_MISSING, reason=_SKIP_REASON)
def test_render_returns_url_and_timing(client: TestClient, hello_code: str) -> None:
    resp = client.post(
        "/render",
        headers={"x-api-key": "test-key-at-least-sixteen-chars"},
        json={
            "code": hello_code,
            "sceneClass": "Hello",
            "render": {"quality": "low", "format": "mp4"},
            "storage": {"backend": "local"},
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["render"]["url"].startswith(("file://", "http"))
    assert body["render"]["bytes"] > 0
    assert body["render"]["width"] == 854
    assert body["render"]["height"] == 480
    assert body["execution"]["totalMs"] > 0


def test_auth_required(client: TestClient, hello_code: str) -> None:
    resp = client.post("/render", json={"code": hello_code, "sceneClass": "Hello"})
    assert resp.status_code == 401


def test_schema_rejects_unknown_field(client: TestClient, hello_code: str) -> None:
    resp = client.post(
        "/render",
        headers={"x-api-key": "test-key-at-least-sixteen-chars"},
        json={"code": hello_code, "sceneClass": "Hello", "oopsTypo": True},
    )
    assert resp.status_code == 422
