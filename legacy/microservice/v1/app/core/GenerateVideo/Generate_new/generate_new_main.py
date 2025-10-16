from pydantic import BaseModel
from core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from core.GenerateVideo.render_and_upload import render_and_upload_manim
from .codeGenerator import generate_all_scenes
from .scenePlanner import planner_agent_function
from .codeMerger import merger_wrapper
from utils.model_provider import MultiTenantModelManager, get_model  # Updated imports

class RequestSchema(BaseModel):
    prompt: str 
    userId: str

async def generate_new_video_main(req: RequestSchema, api_config: dict):
    print("called")
    
    # Use the new context manager for the entire pipeline
    async with MultiTenantModelManager.request_scope(api_config):
        # Step 1: Plan scenes
        
        scenes = await planner_agent_function(prompt=req.prompt)
        print("Planner output:", type(scenes))

        # Step 2: Generate code for each scene
        results = await generate_all_scenes(scenes=scenes) 
        print("Generated results:", results)

        # Step 3: Merge all scenes into one final AnimationScene
        final_code = await merger_wrapper(codes=results)
        print("Final merged code:", final_code)

        # Step 4: Try rendering and uploading (max 3 attempts for debugging)
        for attempt in range(3):
            render_result = render_and_upload_manim(code=final_code, public_id=req.userId)
            
            if render_result.get("success"):
                print(render_result["metadata"])
                return {
                    "code": final_code,
                    "metadata": render_result["metadata"],
                    "error": None
                }

            # Otherwise, failed
            error_msg = render_result.get("error", "Unknown error")
            print(f"Render failed: {error_msg}")

            if attempt < 2:
                # Call debugger to fix code
                final_code = await debugger_agent_wrapper(final_code, error_msg)
            else:
                return {
                    "code": final_code,
                    "metadata": None,
                    "error": error_msg
                }