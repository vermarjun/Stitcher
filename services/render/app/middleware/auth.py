"""X-Api-Key validation middleware.

Single shared secret, validated in constant time. Requests to /health, /capabilities, and /metrics
are exempt so health checkers and scrapers don't need to carry the key.
"""

from __future__ import annotations

import hmac
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings

EXEMPT_PATHS = frozenset({"/health", "/capabilities", "/metrics", "/", "/docs", "/openapi.json", "/redoc"})
# Prefix-exempt paths: locally-served storage URLs (only mounted when STORAGE_BACKEND=local).
EXEMPT_PREFIXES: tuple[str, ...] = ("/files/",)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        if path in EXEMPT_PATHS or path.startswith(EXEMPT_PREFIXES):
            return await call_next(request)

        provided = request.headers.get("x-api-key", "")
        expected = get_settings().render_api_key

        # constant-time comparison to avoid timing oracles
        if not hmac.compare_digest(provided, expected):
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_or_missing_api_key"},
            )

        return await call_next(request)
