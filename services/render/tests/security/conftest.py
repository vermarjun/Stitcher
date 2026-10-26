"""Security tests need the real bwrap sandbox, not the dev-only unsandboxed path.

Also probes whether bwrap can actually set up its namespaces here — Docker Desktop on
macOS disallows `pivot_root` even with SYS_ADMIN, in which case the whole suite must
skip rather than fail spuriously. Real Linux hosts and GitHub Actions Linux runners
satisfy the probe.
"""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Iterator

import pytest

from app.config import reset_settings_for_testing


def _bwrap_works() -> bool:
    if shutil.which("bwrap") is None:
        return False
    try:
        r = subprocess.run(
            ["bwrap", "--unshare-all", "--die-with-parent", "--proc", "/proc",
             "--dev", "/dev", "--tmpfs", "/tmp", "--ro-bind", "/usr", "/usr",
             "--", "/usr/bin/true"],
            capture_output=True, text=True, timeout=5,
        )
        return r.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


_BWRAP_OK = _bwrap_works()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _BWRAP_OK:
        return
    skip = pytest.mark.skip(
        reason="bwrap can't initialise its namespaces here (likely Docker-Desktop-on-macOS "
               "blocking pivot_root). Run on a real Linux host or in Linux CI."
    )
    for item in items:
        # Only skip items under tests/security/ — this conftest runs globally.
        if "tests/security" in str(item.path):
            item.add_marker(skip)


@pytest.fixture(autouse=True)
def _enable_sandbox(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("SANDBOX_ENABLED", "true")
    reset_settings_for_testing()
    yield
    reset_settings_for_testing()
