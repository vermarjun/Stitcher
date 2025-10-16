import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any
import cloudinary.uploader
import time

def render_and_upload_manim(
    code: str,
    scene_name: str = "AnimationScene",
    fps: int = 15,
    quality: str = "l",  
    public_id: Optional[str] = None
) -> Dict[str, Any]:

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = Path("./animation.py")
            script_path.write_text(code, encoding="utf-8")

            # Output directory inside temp
            output_dir = Path("./media")
            output_filename = "animation"

            # --- Render with Manim ---
            cmd = [
                "manim",
                str(script_path),
                scene_name,
                f"-q{quality}",
                "--fps", str(fps),
                "--disable_caching",
                "--flush_cache",
                "--media_dir", str(output_dir),
                "--output_file", output_filename,
                "--progress_bar", "none",
                "-v", "ERROR",
            ]

            process = subprocess.run(cmd, capture_output=True, text=True)
            if process.returncode != 0:
                return {
                    "success": False,
                    "metadata": None,
                    "error": f"Render error: {process.stderr.strip()}",
                }

            # --- Locate video ---
            generated_video = None
            for root, _, files in os.walk(output_dir):
                for file in files:
                    if file.endswith(".mp4"):
                        generated_video = os.path.join(root, file)
                        break
                if generated_video:
                    break

            if not generated_video:
                return {
                    "success": False,
                    "metadata": None,
                    "error": "Video not generated",
                }

            # --- Upload to Cloudinary ---
            try:
                kwargs = {"resource_type": "video"}
                if public_id:
                    kwargs["public_id"] = f"{public_id}_{scene_name}_{int(time.time())}"
                response = cloudinary.uploader.upload(generated_video, **kwargs)
            except Exception as e:
                return {
                    "success": False,
                    "metadata": None,
                    "error": f"Upload error: {str(e)}",
                }
            print("render ka result: ",response)

            # --- Generate thumbnail dynamically ---
            public_id = response.get("public_id")
            duration = response.get("duration") or 2  # fallback in case duration not found
            seek_time = round(duration / 2, 2)        # middle frame

            thumbnail_url = cloudinary.CloudinaryImage(public_id).build_url(
                resource_type="video",
                format="jpg",
                # CLOUDINARY'S AI CHOOSES BEST FRAME
                # transformation=[{"start_offset": "auto", "w": 600, "h": 338, "c": "fill"}]
                # IF THE AI THING FAILS (TEST IT) JUST USE THE MIDDLE FRAME
                transformation=[
                    {"so": seek_time, "w": 600, "h": 338, "c": "fill"}
                ]
            )

            # --- Success ---
            return {
                "success": True,
                "metadata": {
                    "url": response.get("secure_url"),
                    "thumbnail": thumbnail_url,
                    "duration": response.get("duration"),
                    "width": response.get("width"),
                    "height": response.get("height"),
                    "bytes": response.get("bytes"),
                    "public_id": response.get("public_id"),
                },
                "error": None,
            }

    except Exception as e:
        return {
            "success": False,
            "metadata": None,
            "error": f"Unexpected error: {str(e)}",
        }