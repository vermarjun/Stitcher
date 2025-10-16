from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

from core.EditTimeline.timeline_agent import update_timeline
from core.GenerateVideo.Edit_existing import edit_existing_main
from utils.model_provider import MultiTenantModelManager  # New import

router = APIRouter()

class TimelineEditRequest(BaseModel):
    timeline: Dict[str, Any]
    user_prompt: str

class VideoEditRequest(BaseModel):
    username: str
    prompt: str
    lastcode: str

@router.post("/timeline")
async def edit_timeline(req: TimelineEditRequest, request: Request):
    try:
        # Use the new context manager
        async with MultiTenantModelManager.request_scope(request.state.api_config):
            response = await update_timeline(
                timeline=req.timeline, 
                user_prompt=req.user_prompt
                # model_provider removed
            )
        return {
            "status": "success",
            "updated_timeline": response["updated_timeline"],
            "summary_of_changes_made": response["summary_of_changes_made"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/video")
async def edit_video(req: VideoEditRequest, request: Request):
    try:
        # Use the new context manager
        async with MultiTenantModelManager.request_scope(request.state.api_config):
            response = await edit_existing_main(
                username=req.username,
                prompt=req.prompt,
                lastcode=req.lastcode
                # model_provider removed
            )
        return {
            "status": "success",
            "code": response.code,
            "metadata": response.metadata,
            "error": response.error
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))