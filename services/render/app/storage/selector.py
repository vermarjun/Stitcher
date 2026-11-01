"""Choose a storage backend at runtime without importing every SDK.

The cloudinary backend lives in its own module that imports its SDK at module import time.
We only touch it when the deployment has opted in, so a `pip install manim-render-service`
(no extras) never tries to import the cloudinary SDK.
"""

from __future__ import annotations

from functools import cache

from app.storage.base import Storage


@cache
def get_storage(name: str) -> Storage:
    """Instantiate and cache the selected backend. One instance per process."""
    if name == "local":
        from app.storage.local import LocalStorage
        return LocalStorage()  # type: ignore[return-value]
    if name == "cloudinary":
        from app.storage.cloudinary import CloudinaryStorage  # lazy import
        return CloudinaryStorage()  # type: ignore[return-value]
    raise ValueError(
        f"unknown storage backend: {name!r}. Supported: local, cloudinary. "
        "Cloudinary needs the extra: `pip install manim-render-service[cloudinary]`."
    )
