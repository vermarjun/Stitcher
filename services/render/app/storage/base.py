"""Storage interface every backend must implement.

Kept minimal on purpose: the service's contract is `return a URL for this file` — not
`expose a bucket abstraction`. Everything else (signed URLs, ACLs, retention) is the
deployment's job, not the render service's.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class Storage(Protocol):
    """Contract: put bytes somewhere reachable, return a URL and the byte count."""

    name: str

    def put(self, local_path: Path, *, folder: str, public: bool,
            content_type: str | None = None) -> tuple[str, int]:
        """Upload `local_path` and return (url, bytes_written).

        `folder` is a hint, not a guarantee — local backend treats it as a subdirectory,
        cloudinary treats it as its folder tag, s3 treats it as a key prefix. Callers
        shouldn't parse the URL to discover where the file ended up.
        """
        ...

    def health(self) -> tuple[bool, str]:
        """Return (ok, detail). Called from /health; must complete in <2s or return False."""
        ...


class StorageError(RuntimeError):
    """Anything went wrong during put(). Caller wraps this as a 'upload' phase failure."""
