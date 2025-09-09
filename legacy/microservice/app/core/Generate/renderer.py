import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any
import cloudinary.uploader

def render_and_upload_manim(
    code: str,
    scene_name: str = "AnimationScene",
    fps: int = 15,
    quality: str = "l",   # l = lowest/fastest quality
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
            # print("render results: ",process)

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
                    kwargs["public_id"] = public_id
                response = cloudinary.uploader.upload(generated_video, **kwargs)
            except Exception as e:
                return {
                    "success": False,
                    "metadata": None,
                    "error": f"Upload error: {str(e)}",
                }

            # --- Success ---
            return {
                "success": True,
                "metadata": {
                    "url": response.get("secure_url"),
                    "duration": response.get("duration"),
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