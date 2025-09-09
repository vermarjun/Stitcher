from scenePlanner import planner_agent_function
from pydantic import BaseModel
from typing import Optional
from codeGenerator import generate_all_scenes
from codeMerger import merger_wrapper
from renderer import render_and_upload_manim
from debugger import debugger_agent_wrapper

class RequestSchema(BaseModel):
    prompt: str 
    username: str
    lastcode: Optional[str]

async def main_orchestrator(req: RequestSchema):
    # Step 1: Plan scenes
    scenes = await planner_agent_function(prompt=req.prompt)
    # print("Planner output:", scenes)

    # Step 2: Generate code for each scene
    results = await generate_all_scenes(scenes=scenes) 
    # print("Generated results:", results)

    # Step 3: Merge all scenes into one final AnimationScene
    final_code = await merger_wrapper(codes=results)
    # print("Final merged code:", final_code)

    # Step 4: Try rendering and uploading (max 3 attempts)
    for attempt in range(3):
        render_result = render_and_upload_manim(final_code)
        
        if render_result.get("success"):
            # print(render_result["metadata"])
            return {
                "code": final_code,
                "metadata": render_result["metadata"]
            }

        # Otherwise, failed
        error_msg = render_result.get("error", "Unknown error")
        
        # print(f"Render failed: {error_msg}")

        if attempt < 2:
            # Call debugger to fix code
            final_code = await debugger_agent_wrapper(final_code, error_msg)
        else:
            return {
                "code": final_code,
                "error": error_msg
            }
        
import asyncio
asyncio.run(main_orchestrator(RequestSchema(
    prompt="Explain binary search", 
    username="arjun",
    lastcode=None
)))