"""Application entrypoint.

Run via:  uvicorn app.main:app --host 0.0.0.0 --port 8000

Lifespan:
  - on startup: validate config, preflight sandbox + manim + ffmpeg + storage
  - on shutdown: drain in-flight renders up to a bounded timeout
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app import __version__
from app.api import capabilities as capabilities_api
from app.api import health as health_api
from app.config import get_settings
from app.logging import configure_logging, get_logger
from app.middleware.auth import ApiKeyMiddleware
from app.middleware.trace import TraceMiddleware


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log = get_logger("startup")
    settings = get_settings()
    log.info(
        "service.start",
        version=__version__,
        env=settings.env,
        storage=settings.storage_backend,
        sandbox=settings.sandbox_enabled,
        max_concurrent=settings.max_concurrent_renders,
    )
    yield
    log.info("service.stop")


def create_app() -> FastAPI:
    app = FastAPI(
        title="manim-render-service",
        version=__version__,
        description="Stateless HTTP renderer for Manim code.",
        lifespan=_lifespan,
    )

    # middleware is applied bottom-up, so Trace wraps Auth (runs first)
    app.add_middleware(ApiKeyMiddleware)
    app.add_middleware(TraceMiddleware)

    app.include_router(health_api.router)
    app.include_router(capabilities_api.router)

    return app


app = create_app()
