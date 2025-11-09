import asyncio
from pydantic import BaseModel
from .codeGenerator import generate_all_scenes
from .scenePlanner import planner_agent_function
from app.utils.initialize_redis import get_scene_queue_manager
from .summary.planner_summary import summarizer_agent_wrapper
from .chat_updater import ChatUpdater

class GenerateVideoRequest(BaseModel):
    prompt: str 
    userId: str
    chatId: str
    projectId: str
    userName: str

async def generate_new_video_main(req: GenerateVideoRequest):
    # Step 1: Plan scenes
    print("\n=== Step 1: Planning Scenes ===")
    planner_output = await planner_agent_function(prompt=req.prompt)
    print(f"Planner output received: {len(planner_output)} scenes")
    print("Planner output:", planner_output)

    # Step 1.5: Start summarizer agent in background (non-blocking)
    print("\n=== Step 1.5: Starting Summarizer Agent")
    await summarizer_agent_wrapper(
        chat_id=req.chatId,
        planner_output=planner_output
    )
    print("Summarizer agent finished")

    # Step 2: Generate code for each scene
    print("\n=== Step 2: Generating Code ===")
    coder_output = await generate_all_scenes(Scenes=planner_output, max_concurrency=2, per_scene_timeout=180) 
    print(f"Code generation completed: {len(coder_output)} scenes")
    print("Generated results:", coder_output)

    print("coder_output: ",coder_output)

    # Step 2.5: Update MongoDB with generator output
    print("\n=== Step 2.5: Updating Generator Output ===")
    scenes_with_code = [
        {
            "sceneName": scene["sceneName"],
            "code": scene["code"],
            "description": scene["description"]
        }
        for scene in coder_output
    ]

    print("scenes_with_code: ",scenes_with_code)

    await ChatUpdater.update_generator_output(
        chat_id=req.chatId,
        scenes_with_code=scenes_with_code
    )

    print("Generator output updated in MongoDB")

    # Step 3: Enqueue scenes for rendering
    print("\n=== Step 3: Enqueueing Scenes for Rendering ===")
    queue_manager = get_scene_queue_manager()
    
    job_ids = queue_manager.enqueue_all_scenes(
        scenes=scenes_with_code,
        project_id=req.projectId,
        user_id=req.userId,
        chat_id=req.chatId,
        is_edited=False
    )
    
    print(f"Successfully enqueued {len(job_ids)} scenes for rendering")
    print("Job IDs:", job_ids)
    
    return {
        "status": "success",
        "scenes_planned": len(planner_output),
        "scenes_coded": len(coder_output),
        "scenes_enqueued": len(job_ids),
        "job_ids": job_ids
    }