"""Only `local` and `cloudinary` exist. Anything else must fail with a clear error."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.storage.selector import get_storage


def test_local_backend_is_available(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    get_storage.cache_clear()
    assert get_storage("local").name == "local"


@pytest.mark.parametrize("name", ["s3", "gcs", "azure", "nope"])
def test_removed_backends_are_rejected_by_selector(name: str) -> None:
    get_storage.cache_clear()
    with pytest.raises(ValueError, match="unknown storage backend"):
        get_storage(name)


@pytest.mark.parametrize("name", ["s3", "gcs", "azure"])
def test_removed_backends_are_rejected_by_config(name: str) -> None:
    with pytest.raises(ValidationError):
        Settings(render_api_key="x" * 16, storage_backend=name)  # type: ignore[arg-type]
