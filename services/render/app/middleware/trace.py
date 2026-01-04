"""Propagate a trace ID through every request so structured logs correlate end-to-end."""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging import set_trace_id

HEADER = "x-trace-id"


class TraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        trace_id = request.headers.get(HEADER) or f"req-{uuid.uuid4().hex[:12]}"
        set_trace_id(trace_id)
        try:
            response = await call_next(request)
        finally:
            set_trace_id(None)
        response.headers[HEADER] = trace_id
        return response
