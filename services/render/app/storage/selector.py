"""Choose a storage backend at runtime without importing every SDK.

Each cloud backend lives in its own module that imports its SDK at module import time.
We only touch those modules when the deployment has actually opted in — so a
`pip install manim-render-service` (no extras) never tries to import boto3.
"""

from __future__ import annotations

from functools import lru_cache

from app.storage.base import Storage


@lru_cache(maxsize=None)
def get_storage(name: str) -> Storage:
    """Instantiate and cache the selected backend. One instance per process."""
    if name == "local":
        from app.storage.local import LocalStorage
        return LocalStorage()  # type: ignore[return-value]
    if name == "cloudinary":
        from app.storage.cloudinary import CloudinaryStorage  # lazy import
        return CloudinaryStorage()  # type: ignore[return-value]
    if name == "s3":
        from app.storage.s3 import S3Storage  # lazy import
        return S3Storage()  # type: ignore[return-value]
    raise ValueError(
        f"unknown or unavailable storage backend: {name!r}. "
        "Install the matching extra (e.g. `pip install manim-render-service[cloudinary]`)."
    )
