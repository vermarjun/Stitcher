from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel

# from core.EditTimeline.timeline_agent import update_timeline
from core.GenerateVideo.Edit_existing.edit_existing_main import edit_existing_main

router = APIRouter()

class EditVideoRequest(BaseModel):
    userName: str
    prompt: str
    projectId: str
    userId: str
    assetId: list[str]
    chatId: str

async def process_video_generation(req: EditVideoRequest, api_config):
    try:
        print(f"\n{'='*60}")
        print(f"BACKGROUND TASK STARTED - Video Editing")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Project: {req.projectId}")
        print(f"Chat: {req.chatId}")
        print(f"{'='*60}\n")
        
        # This runs independently and updates MongoDB as it progresses
        final_results = await edit_existing_main(
            req=req,
            api_config=api_config
        )
        
        print(f"\n{'='*60}")
        print(f"BACKGROUND TASK COMPLETED - Video generation")
        print(f"Total scenes processed: {len(final_results)}")
        print(f"Chat: {req.chatId}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"BACKGROUND TASK ERROR - Video generation")
        print(f"Chat: {req.chatId}")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\n")
        # TO DO !!
        # POORE ME JO ERROR KA SCENE HAI WO YAHA SE ADD HOGA, WILL ADD IT LATER, AGAR KOI BHI SCENE NAHI GENERATE HUA MS ne hug diya to yaha se add karna padega main error

@router.post("/video")
async def edit_video(req: EditVideoRequest, request: Request, background_tasks: BackgroundTasks):
    try:
        print(f"\n{'='*60}")
        print(f"VIDEO GENERATION REQUEST RECEIVED")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Project: {req.projectId}")
        print(f"Chat: {req.chatId}")
        print(f"Prompt: {req.prompt[:100]}...")
        print(f"{'='*60}\n")
        
        # Add the generation task to background tasks
        # Syntax: background_tasks.add_task(function, arg1, arg2, kwarg1=value1, kwarg2=value2)
        background_tasks.add_task(
            process_video_generation,           # Function to run in background
            req=req,                            # Pass as keyword argument
            api_config=request.state.api_config # Pass as keyword argument
        )
        
        # Return turant - don't wait for processing, will happen in bg
        return {
            "status": "success",
            "message": "Video edit request received and queued successfully",
            "chatId": req.chatId,
            "note": "Processing has started. Poll MongoDB for progress updates."
        }
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR queuing video edit request")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\n")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to queue video edit request: {str(e)}"
        )
    

# class TimelineEditRequest(BaseModel):
#     timeline: Dict[str, Any]
#     user_prompt: str

# NEXT PHASE ME DEKHUNGA ISKO
# @router.post("/timeline")
# async def edit_timeline(req: TimelineEditRequest, request: Request):
#     try:
#         # Use the new context manager
#         async with MultiTenantModelManager.request_scope(request.state.api_config):
#             response = await update_timeline(
#                 timeline=req.timeline, 
#                 user_prompt=req.user_prompt
#                 # model_provider removed
#             )
#         return {
#             "status": "success",
#             "updated_timeline": response["updated_timeline"],
#             "summary_of_changes_made": response["summary_of_changes_made"]
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
