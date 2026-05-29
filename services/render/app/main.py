"""Application entrypoint.

Run via:  uvicorn app.main:app --host 0.0.0.0 --port 8000

Lifespan:
  - on startup: validate config, preflight sandbox + manim + ffmpeg + storage
  - on shutdown: drain in-flight renders up to a bounded timeout
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api import capabilities as capabilities_api
from app.api import health as health_api
from app.api import metrics as metrics_api
from app.api import render as render_api
from app.config import get_settings
from app.logging import configure_logging, get_logger
from app.middleware.auth import ApiKeyMiddleware
from app.middleware.trace import TraceMiddleware
from app.observability import configure_observability


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

    # OpenTelemetry tracing + metrics. Programmatic init so it works regardless of
    # how uvicorn is launched (additive; fail-soft if the collector is down).
    # FastAPIInstrumentor.instrument_app() extracts incoming W3C `traceparent`, so
    # render spans become children of the API's trace. See app/observability.py.
    configure_observability(app)

    # middleware is applied bottom-up, so Trace wraps Auth (runs first)
    app.add_middleware(ApiKeyMiddleware)
    app.add_middleware(TraceMiddleware)

    app.include_router(health_api.router)
    app.include_router(capabilities_api.router)
    app.include_router(render_api.router)
    app.include_router(metrics_api.router)

    # When STORAGE_BACKEND=local, expose the storage dir at /files/ so the
    # public URLs returned by LocalStorage are actually fetchable.
    settings = get_settings()
    if settings.storage_backend == "local":
        from pathlib import Path
        storage_path = Path(settings.local_storage_path)
        storage_path.mkdir(parents=True, exist_ok=True)
        app.mount(
            "/files",
            StaticFiles(directory=str(storage_path), check_dir=False),
            name="files",
        )

    return app


app = create_app()
