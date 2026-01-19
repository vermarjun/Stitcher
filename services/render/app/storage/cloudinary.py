"""Cloudinary upload backend. Requires `pip install manim-render-service[cloudinary]`.

Notes:
  - We use the uploader's `resource_type="auto"` so it detects video/image by the bytes.
  - Public IDs are unset — Cloudinary generates them from a hash of the filename, which is
    fine for us since the pipeline writes to uniquely-named tempfiles.
  - The `folder` argument maps to a Cloudinary folder tag, not a path prefix; bills the
    same either way but folders make the dashboard UI navigable.
  - Health check pings the admin API with a no-op ping(). Cheap (few tens of ms).
"""

from __future__ import annotations

import os
from pathlib import Path

import cloudinary  # type: ignore[import-not-found]
import cloudinary.api  # type: ignore[import-not-found]
import cloudinary.uploader  # type: ignore[import-not-found]

from app.config import get_settings
from app.storage.base import StorageError


class CloudinaryStorage:
    name = "cloudinary"

    def __init__(self) -> None:
        settings = get_settings()
        url = settings.cloudinary_url or os.environ.get("CLOUDINARY_URL")
        if not url:
            raise StorageError(
                "storage_backend=cloudinary but CLOUDINARY_URL is not set. "
                "Expected format: cloudinary://<api_key>:<api_secret>@<cloud_name>"
            )
        # cloudinary.config() reads CLOUDINARY_URL from the env by default; we export it
        # explicitly in case the user passed it through the pydantic settings object only.
        os.environ.setdefault("CLOUDINARY_URL", url)
        cloudinary.config()

    def put(self, local_path: Path, *, folder: str, public: bool,
            content_type: str | None = None) -> tuple[str, int]:
        if not local_path.exists():
            raise StorageError(f"source file missing: {local_path}")
        try:
            resp = cloudinary.uploader.upload(
                str(local_path),
                resource_type="auto",
                folder=folder,
                use_filename=False,
                unique_filename=True,
                overwrite=False,
                type="upload" if public else "private",
            )
        except Exception as e:  # noqa: BLE001 — cloudinary raises a zoo of exception types
            raise StorageError(f"cloudinary upload failed: {e}") from e

        url = resp.get("secure_url") or resp.get("url")
        size = int(resp.get("bytes") or local_path.stat().st_size)
        if not url:
            raise StorageError(f"cloudinary returned no URL: {resp!r}")
        return url, size

    def health(self) -> tuple[bool, str]:
        try:
            cloudinary.api.ping()
            return True, "cloudinary reachable"
        except Exception as e:  # noqa: BLE001
            return False, f"{type(e).__name__}: {e}"
