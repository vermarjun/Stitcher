"""Local-disk storage. Default backend; useful for dev, CI, on-prem deployments.

The URL we return is `file://<abs-path>` unless `local_storage_public_url_base` is set,
in which case we join that base with the relative path under the storage root. Pair this
with an nginx or caddy sidecar serving the storage directory if you want HTTP URLs.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.config import get_settings
from app.storage.base import StorageError


class LocalStorage:
    name = "local"

    def __init__(self) -> None:
        settings = get_settings()
        self.root: Path = Path(settings.local_storage_path)
        self.base_url: str = settings.local_storage_public_url_base
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, local_path: Path, *, folder: str, public: bool,
            content_type: str | None = None) -> tuple[str, int]:
        if not local_path.exists():
            raise StorageError(f"source file missing: {local_path}")
        safe_folder = folder.strip("/") or "renders"
        dest_dir = self.root / safe_folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_name = f"{uuid.uuid4().hex}{local_path.suffix}"
        dest = dest_dir / dest_name
        try:
            shutil.copy2(local_path, dest)
        except OSError as e:
            raise StorageError(f"copy failed: {e}") from e
        size = dest.stat().st_size

        relative = f"{safe_folder}/{dest_name}"
        url = (
            f"{self.base_url.rstrip('/')}/{relative}"
            if self.base_url and not self.base_url.startswith("file://")
            else f"file://{dest.resolve()}"
        )
        return url, size

    def health(self) -> tuple[bool, str]:
        try:
            probe = self.root / ".healthcheck"
            probe.write_bytes(b"ok")
            probe.unlink()
            return True, f"writable at {self.root}"
        except OSError as e:
            return False, f"{type(e).__name__}: {e}"
