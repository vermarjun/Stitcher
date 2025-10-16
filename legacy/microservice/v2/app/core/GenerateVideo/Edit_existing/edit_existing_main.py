from pydantic import BaseModel
from .code_editor import code_modify_function
from core.GenerateVideo.render_and_upload import render_and_upload_manim
from core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from utils.model_provider import MultiTenantModelManager  # Changed import

class RequestSchema(BaseModel):
    prompt: str 
    username: str
    lastcode: str

async def edit_existing_main(req: RequestSchema):
    """Updated to use context-based model provider"""
    # update the code based on request
    updated_code = await code_modify_function(
        original_code=req.lastcode, 
        modification_prompt=req.prompt
        # model_provider removed
    )

    # Try rendering the updated code and try to upload it (max 3 attempts for debugging)
    for attempt in range(3):
        render_result = render_and_upload_manim(code=updated_code, public_id=req.username)
        
        if render_result.get("success"):
            return {
                "code": updated_code,
                "metadata": render_result["metadata"],
                "error": None  # Added for consistency
            }

        # Otherwise, failed
        error_msg = render_result.get("error", "Unknown error")

        if attempt < 2:
            # Call debugger to fix code
            updated_code = await debugger_agent_wrapper(
                updated_code, 
                error_msg
                # model_provider removed
            )
        else:
            return {
                "code": updated_code,
                "metadata": None,
                "error": error_msg
            }