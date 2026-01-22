"""GET /metrics — Prometheus scrape endpoint. Exempt from API-key auth."""

from __future__ import annotations

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.config import get_settings

router = APIRouter()


@router.get("/metrics", tags=["observability"])
def metrics() -> Response:
    if not get_settings().metrics_enabled:
        return Response(status_code=404, content="metrics disabled")
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
