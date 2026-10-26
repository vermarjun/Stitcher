"""POST /render — the one endpoint that matters.

Returns HTTP 200 with `success: true|false` on either success OR a user-attributable
failure (bad code, timeout, OOM). HTTP 5xx is reserved for bugs in THIS service: an
unreachable storage backend, a crashing sandbox, etc. This keeps caller branching simple
— if you got a 200, parse the body; if you got a 5xx, retry or alert.

Saturation: if all render slots are in use the caller gets a plain 503 with a
`Retry-After` header, NOT a 200/success:false — this is a signal to back off, not a user
error to surface in the UI.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from app.core.pipeline import run
from app.core.semaphore import SaturatedError, acquire
from app.logging import get_logger
from app.models import RenderRequest

router = APIRouter()
log = get_logger("api.render")


@router.post(
    "/render",
    response_model=None,
    responses={
        200: {"description": "Render finished (may be success OR structured failure)"},
        400: {"description": "Malformed request (schema violation)"},
        401: {"description": "Missing or invalid API key"},
        503: {"description": "Service saturated — retry after Retry-After seconds"},
    },
    tags=["render"],
)
async def render(req: RenderRequest, response: Response) -> Any:
    try:
        async with acquire():
            result = await run(req)
    except SaturatedError as e:
        log.warning("render.saturated", active=e.active, maximum=e.maximum)
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": str(e.retry_after_sec)},
            content={"error": "service saturated",
                     "active": e.active, "max": e.maximum,
                     "retryAfterSec": e.retry_after_sec},
        )

    if not result.success:
        log.info("render.failed", phase=result.error.phase, category=result.error.category)
    return result.model_dump(by_alias=True, exclude_none=True)
