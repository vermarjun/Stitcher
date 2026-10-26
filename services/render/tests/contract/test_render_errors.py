"""POST /render failure paths — every failure mode returns HTTP 200 with success=false."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

pytestmark = pytest.mark.contract

_FIX = Path(__file__).parent.parent / "fixtures" / "manim"
_MANIM_MISSING = shutil.which("manim") is None


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def _post(client: TestClient, code: str, scene: str) -> dict:
    r = client.post(
        "/render",
        headers={"x-api-key": "test-key-at-least-sixteen-chars"},
        json={"code": code, "sceneClass": scene},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_forbidden_import_rejected_without_sandbox(client: TestClient) -> None:
    body = _post(client, (_FIX / "forbidden_import.py").read_text(), "Hello")
    assert body["success"] is False
    assert body["error"]["phase"] == "validation"
    assert "os" in body["error"]["summary"]


@pytest.mark.skipif(_MANIM_MISSING, reason="manim not installed")
def test_syntax_error_surfaces_line(client: TestClient) -> None:
    body = _post(client, (_FIX / "broken_syntax.py").read_text(), "Broken")
    assert body["success"] is False
    assert body["error"]["category"] == "SyntaxError"
    assert body["error"]["line"] is not None


@pytest.mark.skipif(_MANIM_MISSING, reason="manim not installed")
def test_name_error_surfaces_line(client: TestClient) -> None:
    body = _post(client, (_FIX / "broken_name.py").read_text(), "BadName")
    assert body["success"] is False
    assert body["error"]["category"] == "NameError"


def test_unknown_scene_class_rejected_by_pattern() -> None:
    c = TestClient(create_app())
    r = c.post(
        "/render",
        headers={"x-api-key": "test-key-at-least-sixteen-chars"},
        json={"code": "x=1", "sceneClass": "bad name with spaces"},
    )
    assert r.status_code == 422
