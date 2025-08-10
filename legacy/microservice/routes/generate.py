from fastapi import APIRouter, HTTPException, Depends, status, Body, Request
from pydantic import BaseModel
import subprocess
from typing import Optional
import os
import cloudinary.uploader
from pathlib import Path

router = APIRouter()

# Request body model
class ManimRequest(BaseModel):
    username: str
    code: str
    verification_token: str
    scene_name: Optional[str] = "Scene"  
    quality: Optional[str] = "l"
    # resolution: Optional[str] = "W,H"

script_path = Path("./animation.py")
output_dir = Path("./media")
output_filename = "finaloutput"

@router.post("/video")
async def generate_video(req: ManimRequest):
    try:    
        # 1. Save received code into a file
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(req.code)

        # 3. Run Manim command
        # Assuming the Manim class in code is named "SceneClass"

        cmd = [
            "manim",
            "render",
            script_path,
            "SceneClass",  
            "--disable_caching",
            "--flush_cache",
            f"-q{req.quality}",  # "l" = low, "h" = HD, "k"= 4k
            # f"-r{req.resolution}",  # "W", "H"
            "--custom_folders", 
            f"--media_dir={output_dir}",
            f"--output_file={output_filename}", 
            "--progress_bar=none",
            "-vwarning"
        ]

        subprocess.run(cmd, check=True)

        # 4. Find the generated video file
        generated_video = None
        for root, _, files in os.walk(output_dir):
            for file in files:
                if file.endswith(".mp4"):
                    generated_video = os.path.join(root, file)
                    break
        if not generated_video:
            raise HTTPException(status_code=500, detail="Video not generated")

        # 5. Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            generated_video,
            resource_type="video",
            public_id=f"{req.username}_manim_animation"
        )

        return {
            "status": "success",
            "cloudinary_metadata": upload_result
        }

    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Manim execution failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
