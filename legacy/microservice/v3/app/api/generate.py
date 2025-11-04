from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel

from core.GenerateVideo.Generate_new.generate_new_main import generate_new_video_main

router = APIRouter()

class GenerateVideoRequest(BaseModel):
    prompt: str 
    userId: str
    chatId: str
    projectId: str
    userName: str

async def process_video_generation(req: GenerateVideoRequest):
    try:
        print(f"\n{'='*60}")
        print(f"BACKGROUND TASK STARTED - Video generation")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Project: {req.projectId}")
        print(f"Chat: {req.chatId}")
        print(f"{'='*60}\n")
        
        # This runs independently and updates MongoDB as it progresses
        final_results = await generate_new_video_main(req=req)
        
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
async def generate_video(req: GenerateVideoRequest, background_tasks: BackgroundTasks):
    try:
        print(f"\n{'='*60}")
        print(f"VIDEO GENERATION REQUEST RECEIVED")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Project: {req.projectId}")
        print(f"Chat: {req.chatId}")
        print(f"Prompt: {req.prompt[:100]}...")
        print(f"{'='*60}\n")
        
        # Add the generation task to background tasks
        background_tasks.add_task(
            process_video_generation,           # Function to run in background
            req=req,                            # Pass as keyword argument
        )

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