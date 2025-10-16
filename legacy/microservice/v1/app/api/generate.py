from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.GenerateVideo.Generate_new.generate_new_main import generate_new_video_main
from utils.model_provider import MultiTenantModelManager  # New import

router = APIRouter()

class GenerateVideoRequest(BaseModel):
    userId: str
    prompt: str

@router.post("/video")
async def generate_video(req: GenerateVideoRequest, request: Request):
    try:
        response = await generate_new_video_main(
            req=req,
            api_config=request.state.api_config  # Pass config instead of provider
        )
        return {
            "llmResponse": "success",
            "code": response["code"],
            "cloudinaryMetadata": response["metadata"],
            "error": response["error"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))