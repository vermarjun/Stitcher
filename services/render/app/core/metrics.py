"""Prometheus counters and histograms, opt-in via `METRICS_ENABLED`.

Metrics are kept deliberately flat — four series total — because cardinality explodes
cost in Prometheus and nobody paged on a fine-grained manim metric in their life:

  mrs_renders_total{status, category}         — outcome counter
  mrs_render_seconds{phase}                   — duration histogram (validation|sandbox|upload|total)
  mrs_active_renders                          — gauge, reflects semaphore state
  mrs_saturated_rejections_total              — counter, 503s due to full slots

All increments are no-ops when `metrics_enabled=False`, so callers can sprinkle them
throughout the pipeline without a feature-flag check.
"""

from __future__ import annotations

from typing import Any

from prometheus_client import Counter, Gauge, Histogram

from app.config import get_settings


class _NoOp:
    def labels(self, **_kw: Any) -> "_NoOp": return self
    def inc(self, *_a: Any, **_kw: Any) -> None: return None
    def dec(self, *_a: Any, **_kw: Any) -> None: return None
    def observe(self, *_a: Any, **_kw: Any) -> None: return None
    def set(self, *_a: Any, **_kw: Any) -> None: return None


def _build():
    if not get_settings().metrics_enabled:
        noop = _NoOp()
        return noop, noop, noop, noop

    renders = Counter(
        "mrs_renders_total", "Total renders completed, by outcome.",
        labelnames=("status", "category"),
    )
    render_seconds = Histogram(
        "mrs_render_seconds", "Render phase duration in seconds.",
        labelnames=("phase",),
        buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300),
    )
    active = Gauge("mrs_active_renders", "Currently running renders.")
    saturated = Counter("mrs_saturated_rejections_total", "Requests rejected due to saturation.")
    return renders, render_seconds, active, saturated


renders, render_seconds, active, saturated = _build()
