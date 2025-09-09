from fastapi import APIRouter, HTTPException, Depends, status, Body, Request
from pydantic import BaseModel
import subprocess
from typing import Optional
import os
import cloudinary.uploader
from pathlib import Path

from Agent.agent import process_manim_prompt

router = APIRouter()

class ManimRequest(BaseModel):
    username: str
    prompt: str
    previous_code: Optional[str] = None
    quality: Optional[str] = "l"

script_path = Path("./animation.py")
output_dir = Path("./media")
output_filename = "finaloutput"

@router.post("/video")
async def generate_video(req: ManimRequest = Body(...), request: Request = None):
    client = request.app.state.openai_client
    assistant_id = request.app.state.manim_assistant.id
    try:
        public_id = f"{req.username}_manim_animation"
        metadata, code = process_manim_prompt(
            client=client,
            assistant_id=assistant_id,
            thread_id=req.thread_id,
            prompt=req.prompt,
            previous_code=req.previous_code,
            quality=req.quality,
            public_id=public_id
        )

        return {
            "status": "success",
            "cloudinary_metadata": metadata,
            "code": code
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))