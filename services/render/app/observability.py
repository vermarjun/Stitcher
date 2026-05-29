"""OpenTelemetry tracing + metrics — additive, fail-soft instrumentation.

This module is the single place that wires the render service into the Stitcher
observability stack (see Plan/OBSERVABILITY.md §3, §3d). It is intentionally
*additive*: nothing here changes render behaviour, response schemas, or the
sandbox. If the OTLP collector is unreachable the batch exporter silently drops
spans/metrics — no exception ever escapes into the request path.

Conventions enforced here (contract §3):
  - Export protocol : OTLP over HTTP/protobuf (port 4318), NOT gRPC.
  - Endpoint env    : OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318).
  - service.name    : stitcher-render (override via OTEL_SERVICE_NAME).
  - Resource attrs  : service.name, service.version, deployment.environment (ENV).
  - Propagation     : W3C Trace Context (the OTel default) — FastAPIInstrumentor
                      extracts incoming `traceparent`, so render spans become
                      children of the API's trace automatically.
  - Legacy bridge   : the human-facing X-Trace-Id header is attached as the span
                      attribute `stitcher.trace_id` (see set_trace_id_on_span).

Init is programmatic (called from the app factory) so it works regardless of how
uvicorn is launched. The `opentelemetry-instrument uvicorn ...` CLI wrapper is an
ALTERNATIVE, not a requirement — see README "Observability".
"""

from __future__ import annotations

import contextlib
import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI
    from opentelemetry.metrics import Histogram, UpDownCounter
    from opentelemetry.trace import Span, Tracer

# --- service identity / resource attrs --------------------------------------

SERVICE_NAME = os.environ.get("OTEL_SERVICE_NAME", "stitcher-render")
SERVICE_VERSION = "0.1.0"

# Module-level handles, populated by configure_observability(). They start as
# no-op-friendly None and are replaced on successful init; helpers below degrade
# gracefully when OTel is disabled or failed to configure.
_tracer: Tracer | None = None
_render_duration: Histogram | None = None
_render_active: UpDownCounter | None = None
_configured = False


def configure_observability(app: FastAPI) -> bool:
    """Configure the global TracerProvider + MeterProvider and instrument `app`.

    Idempotent and fail-soft: any error during setup is swallowed (logged) so the
    service still boots without a collector. Returns True if OTel was wired up,
    False if it was skipped or failed.
    """
    global _tracer, _render_duration, _render_active, _configured

    if _configured:
        return _tracer is not None

    _configured = True  # never attempt twice, even on failure

    # Honour an explicit opt-out without requiring a collector to be reachable.
    if os.environ.get("OTEL_SDK_DISABLED", "").lower() in {"1", "true", "yes"}:
        return False

    try:
        from opentelemetry import metrics, trace
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
            OTLPMetricExporter,
        )
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        endpoint = os.environ.get(
            "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"
        ).rstrip("/")
        environment = os.environ.get("ENV", "dev")

        resource = Resource.create(
            {
                "service.name": SERVICE_NAME,
                "service.version": SERVICE_VERSION,
                "deployment.environment": environment,
            }
        )

        # --- traces -> OTLP/HTTP (BatchSpanProcessor drops on export failure) ---
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces"),
            )
        )
        trace.set_tracer_provider(tracer_provider)

        # --- metrics -> OTLP/HTTP (periodic reader; export failures are dropped) ---
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=f"{endpoint}/v1/metrics"),
        )
        meter_provider = MeterProvider(
            resource=resource, metric_readers=[metric_reader]
        )
        metrics.set_meter_provider(meter_provider)

        # --- auto-instrument FastAPI (extracts incoming W3C traceparent) ---
        # excluded_urls keeps health/metrics noise out of Tempo.
        FastAPIInstrumentor.instrument_app(
            app, excluded_urls="health,metrics,capabilities"
        )

        # --- auto-instrument outbound `requests` (storage backends use it) ---
        with contextlib.suppress(Exception):  # optional, never block boot
            from opentelemetry.instrumentation.requests import RequestsInstrumentor

            RequestsInstrumentor().instrument()

        # --- correlate Python logging with the active trace (best effort) ---
        with contextlib.suppress(Exception):
            from opentelemetry.instrumentation.logging import LoggingInstrumentor

            LoggingInstrumentor().instrument(set_logging_format=False)

        _tracer = trace.get_tracer("stitcher.render")

        meter = metrics.get_meter("stitcher.render")
        # §3d render metrics.
        _render_duration = meter.create_histogram(
            name="stitcher.render.duration",
            unit="ms",
            description="Manim render wall-clock duration in milliseconds.",
        )
        _render_active = meter.create_up_down_counter(
            name="stitcher.render.active",
            unit="1",
            description="Renders currently executing (live concurrency).",
        )
        return True
    except Exception:  # noqa: BLE001 — observability must never break boot
        import logging

        logging.getLogger("observability").warning(
            "OpenTelemetry init failed; continuing without tracing/metrics",
            exc_info=True,
        )
        _tracer = None
        _render_duration = None
        _render_active = None
        return False


# --- helpers used by the pipeline / middleware ------------------------------


def get_tracer() -> Tracer | None:
    """Return the configured tracer, or None when OTel is disabled."""
    return _tracer


def record_render_duration(duration_ms: float, *, quality: str, success: bool) -> None:
    """Record the `stitcher.render.duration` histogram (no-op if disabled)."""
    if _render_duration is not None:
        with contextlib.suppress(Exception):
            _render_duration.record(
                duration_ms, {"quality": quality, "success": success}
            )


def add_active_render(delta: int) -> None:
    """Increment/decrement the `stitcher.render.active` up/down counter."""
    if _render_active is not None:
        with contextlib.suppress(Exception):
            _render_active.add(delta)


def set_trace_id_on_span(trace_id: str | None) -> None:
    """Attach the human-facing X-Trace-Id to the currently active span.

    Contract §3 legacy bridge: makes Tempo searchable by the id threaded through
    every service log and progress event.
    """
    if not trace_id or _tracer is None:
        return
    with contextlib.suppress(Exception):
        from opentelemetry import trace as _trace

        current = _trace.get_current_span()
        if current is not None and current.get_span_context().is_valid:
            current.set_attribute("stitcher.trace_id", trace_id)


@contextmanager
def span(name: str, **attributes: Any) -> Iterator[Span | None]:
    """Start a manual span as a child of the active context.

    Fail-soft: when OTel is disabled this is a zero-overhead no-op yielding None,
    so the pipeline can wrap steps unconditionally. Exceptions raised inside the
    block are recorded and the span status is set to ERROR, then re-raised — the
    caller's existing control flow is preserved exactly.
    """
    if _tracer is None:
        yield None
        return

    from opentelemetry.trace import Status, StatusCode

    clean = {k: v for k, v in attributes.items() if v is not None}
    with _tracer.start_as_current_span(name, attributes=clean) as sp:
        try:
            yield sp
        except Exception as exc:  # noqa: BLE001 — record then re-raise, never swallow
            try:
                sp.record_exception(exc)
                sp.set_status(Status(StatusCode.ERROR, str(exc)))
            except Exception:  # noqa: BLE001
                pass
            raise


def set_span_error(sp: Span | None, message: str) -> None:
    """Mark a span as ERROR without raising (for handled, non-exception failures
    like a non-zero manim exit code that the pipeline turns into a 200 response)."""
    if sp is None:
        return
    with contextlib.suppress(Exception):
        from opentelemetry.trace import Status, StatusCode

        sp.set_status(Status(StatusCode.ERROR, message))
