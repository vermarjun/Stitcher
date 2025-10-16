# from fastapi import APIRouter, HTTPException, Request
# from pydantic import BaseModel
# from core.GenerateVideo.Generate_new.generate_new_main import generate_new_video_main
# from utils.model_provider import MultiTenantModelManager  # New import

# router = APIRouter()

# class GenerateVideoRequest(BaseModel):
#     userId: str
#     prompt: str

# @router.post("/video")
# async def generate_video(req: GenerateVideoRequest, request: Request):
#     try:
#         Scenes = await generate_new_video_main(
#             req=req,
#             api_config=request.state.api_config  # Pass config instead of provider
#         )
#         print("\n Scenes Recieved! \n", len(Scenes))
#         for scene in Scenes:
#             print("\n", scene)

#         # NOTE SCENES HERE IS:
#         """
#         [
#             {
#                 code
#                 metadata
#                 error
#             }
#         ]
#         """

#         return {
#             "llmResponse": "success",
#             "Scenes": Scenes
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
import asyncio
from core.GenerateVideo.Generate_new.generate_new_main import generate_new_video_main

router = APIRouter()

class GenerateVideoRequest(BaseModel):
    userId: str
    userName: str
    prompt: str
    projectId: str
    chatId: str

async def process_video_generation(req: GenerateVideoRequest, api_config):
    try:
        print(f"\n{'='*60}")
        print(f"BACKGROUND TASK STARTED - Video generation")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Project: {req.projectId}")
        print(f"Chat: {req.chatId}")
        print(f"{'='*60}\n")
        
        # This runs independently and updates MongoDB as it progresses
        final_results = await generate_new_video_main(
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
        # Error should already be logged in MongoDB by generate_new_video_main
        # If not, you might want to add a final error update to MongoDB here

@router.post("/video")
async def generate_video(req: GenerateVideoRequest, request: Request, background_tasks: BackgroundTasks):
    """
    Generate video endpoint - immediately returns success after queuing the task.
    
    Flow:
    1. Validates request
    2. Adds generation task to background tasks
    3. Returns immediate success response
    4. Microservice updates MongoDB progressively (backend polls for updates)
    
    Returns:
        Immediate acknowledgment that request was received and queued
    """
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
        
        # Alternatively, you can pass positional arguments:
        # background_tasks.add_task(process_video_generation, req, request.state.api_config)
        
        # Return immediately - don't wait for processing
        return {
            "status": "success",
            "message": "Video generation request received and queued successfully",
            "chatId": req.chatId,
            "note": "Processing has started. Poll MongoDB for progress updates."
        }
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR queuing video generation request")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\n")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to queue video generation request: {str(e)}"
        )