"""Shared pytest fixtures.

The render-service tests split into three tiers:
  - unit       : pure-python, no subprocess, no bwrap — run anywhere
  - contract   : HTTP API surface, uses FastAPI TestClient; needs manim+ffmpeg in PATH
  - security   : sandbox-escape attempts; REQUIRES bwrap (Linux container only)

`pytest -m "not security"` is the default for local dev on macOS.
"""

from __future__ import annotations

import os
import shutil
from collections.abc import Iterator

import pytest

from app.config import reset_settings_for_testing


@pytest.fixture(autouse=True)
def _isolate_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Reset the config singleton between tests so env overrides actually apply."""
    monkeypatch.setenv("RENDER_API_KEY", "test-key-at-least-sixteen-chars")
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.setenv("SANDBOX_ENABLED", "false")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    reset_settings_for_testing()
    yield
    reset_settings_for_testing()


@pytest.fixture
def bwrap_available() -> bool:
    return shutil.which("bwrap") is not None


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Auto-skip security tests when bwrap isn't installed (i.e. on macOS dev)."""
    if shutil.which("bwrap") is not None and os.environ.get("SKIP_SECURITY") != "1":
        return
    skip = pytest.mark.skip(reason="bwrap not available — security tests require Linux sandbox")
    for item in items:
        if "security" in item.keywords:
            item.add_marker(skip)
