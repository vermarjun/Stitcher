"""Application settings.

Every env var is declared here with a typed default. No config lives outside this module.
Validated once at process start — bad config fails fast instead of at request time.
"""

from __future__ import annotations

import multiprocessing
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Deployment ---
    env: Literal["dev", "staging", "production"] = "dev"

    # --- Auth ---
    render_api_key: str = Field(..., min_length=16, description="Required header for every request")

    # --- Sandbox ---
    sandbox_enabled: bool = True
    """Set to False only on macOS dev machines without bwrap. Refuses to start if env=production."""

    sandbox_timeout_default: int = 120
    sandbox_memory_mb_default: int = 2048
    sandbox_cpu_default: float = 1.5

    # --- Storage ---
    storage_backend: Literal["local", "cloudinary"] = "local"
    local_storage_path: Path = Path("/tmp/renders")
    local_storage_public_url_base: str = "file://"

    # Cloudinary
    cloudinary_url: str | None = None

    # --- Concurrency ---
    max_concurrent_renders: int = Field(default_factory=lambda: multiprocessing.cpu_count())
    queue_full_policy: Literal["reject", "block"] = "reject"
    queue_wait_timeout_sec: int = 30

    # --- Manim runtime ---
    manim_path: str = "/opt/venv/bin/manim"
    python_path: str = "/opt/venv/bin/python"
    ffmpeg_path: str = "/usr/bin/ffmpeg"

    # --- Limits ---
    max_code_bytes: int = 524_288          # 512 KB
    max_audio_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_timeout_sec: int = 600

    # --- Observability ---
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"
    metrics_enabled: bool = True

    @field_validator("sandbox_enabled")
    @classmethod
    def _sandbox_must_be_on_in_production(cls, v: bool, info) -> bool:  # type: ignore[no-untyped-def]
        env = info.data.get("env", "dev")
        if env == "production" and not v:
            raise ValueError("sandbox_enabled=False is forbidden when env=production")
        return v

    @field_validator("local_storage_path")
    @classmethod
    def _local_path_abs(cls, v: Path) -> Path:
        return v.resolve()


_settings: Settings | None = None


def get_settings() -> Settings:
    """Lazy singleton so tests can override via env before first access."""
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
    return _settings


def reset_settings_for_testing() -> None:
    """Test helper — drop the cached singleton so new env vars take effect."""
    global _settings
    _settings = None
