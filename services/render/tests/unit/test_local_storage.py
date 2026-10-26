from __future__ import annotations

from pathlib import Path

import pytest

from app.config import reset_settings_for_testing
from app.storage.base import StorageError
from app.storage.local import LocalStorage


@pytest.fixture
def storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> LocalStorage:
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    reset_settings_for_testing()
    return LocalStorage()


def test_put_copies_file_and_returns_file_url(storage: LocalStorage, tmp_path: Path) -> None:
    src = tmp_path / "clip.mp4"
    src.write_bytes(b"\x00\x01\x02\x03")
    url, size = storage.put(src, folder="renders/daily", public=True, content_type="video/mp4")
    assert url.startswith("file://")
    assert size == 4


def test_put_errors_on_missing_source(storage: LocalStorage, tmp_path: Path) -> None:
    with pytest.raises(StorageError):
        storage.put(tmp_path / "nope.mp4", folder="renders", public=True)


def test_health_reports_writable(storage: LocalStorage) -> None:
    ok, detail = storage.health()
    assert ok
    assert "writable" in detail
