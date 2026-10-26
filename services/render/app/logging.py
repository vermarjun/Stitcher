"""Structured logging via structlog.

Every log line is JSON in prod. Trace ID propagation happens via contextvars so downstream
code never has to pass loggers or trace IDs explicitly.
"""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar
from typing import Any

import structlog

from app.config import get_settings

_trace_id: ContextVar[str | None] = ContextVar("trace_id", default=None)


def set_trace_id(trace_id: str | None) -> None:
    _trace_id.set(trace_id)


def get_trace_id() -> str | None:
    return _trace_id.get()


def _inject_trace_id(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    tid = _trace_id.get()
    if tid is not None:
        event_dict.setdefault("traceId", tid)
    return event_dict


def configure_logging() -> None:
    settings = get_settings()

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level),
    )

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _inject_trace_id,
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.log_format == "json":
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name) if name else structlog.get_logger()
