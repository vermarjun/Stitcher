import asyncio
from pydantic import BaseModel
from .codeGenerator import generate_all_scenes
from .scenePlanner import planner_agent_function
from app.utils.initialize_redis import get_scene_queue_manager
from .summary.planner_summary import summarizer_agent_wrapper
from .chat_updater import ChatUpdater
from app.utils.event_publisher import publish_event

class GenerateVideoRequest(BaseModel):
    prompt: str 
    userId: str
    chatId: str
    projectId: str
    userName: str

async def generate_new_video_main(req: GenerateVideoRequest):
    # Step 1: Plan scenes
    print("\n=== Step 1: Planning Scenes ===")
    publish_event(req.chatId, "PLANNING_START", {"message": "Started planning scenes..."})
    
    planner_output = await planner_agent_function(prompt=req.prompt)
    
    publish_event(req.chatId, "PLANNING_COMPLETE", {
        "message": f"Planned {len(planner_output)} scenes", 
        "sceneCount": len(planner_output)
    })
    
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
    publish_event(req.chatId, "GENERATING_CODE_START", {"message": "Generating code for scenes..."})
    
    coder_output = await generate_all_scenes(Scenes=planner_output, max_concurrency=2, per_scene_timeout=180) 
    
    publish_event(req.chatId, "GENERATING_CODE_COMPLETE", {
        "message": "Code generation completed",
        "scenes": coder_output
    })
    
    print(f"Code generation completed: {len(coder_output)} scenes")
    print("Generated results:", coder_output)

    print("coder_output: ",coder_output)

    # Step 2.5: Update MongoDB with generator output
    print("\n=== Step 2.5: Updating Generator Output ===")
    scenes_with_code = [
        {
            "sceneName": scene["sceneName"],
            "code": scene["code"],
            "description": scene["description"],
            "RequiredMObjects": getattr(next((s for s in planner_output if s.SceneName == scene["sceneName"]), None), 'RequiredMObjects', []),
            "RequiredAnimations": getattr(next((s for s in planner_output if s.SceneName == scene["sceneName"]), None), 'RequiredAnimations', [])
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
    
    publish_event(req.chatId, "ENQUEUED_FOR_RENDERING", {
        "message": f"Enqueued {len(job_ids)} scenes for rendering",
        "jobIds": job_ids
    })
    
    print(f"Successfully enqueued {len(job_ids)} scenes for rendering")
    print("Job IDs:", job_ids)
    
    # Step 4: Wait for all jobs to complete
    print("\n=== Step 4: Waiting for Job Completion ===")
    from app.utils.job_tracker import JobCompletionTracker
    tracker = JobCompletionTracker(queue_manager.redis)

    # Extract just the job IDs
    job_id_list = [job['jobId'] for job in job_ids]

    # Wait for all jobs (blocks here until done)
    job_results = await tracker.wait_for_jobs(job_id_list, poll_interval=5, timeout=1800)

    print(f"All jobs completed. {len(job_results)} results collected.")

    # Step 5: Gather scene results for summary
    scene_results = []
    for job_result in job_results:
        # Match job result to original scene
        matching_job = next((j for j in job_ids if j['jobId'] == job_result['jobId']), None)
        
        if matching_job:
            scene_results.append({
                'sceneName': matching_job['sceneName'],
                'sceneIndex': matching_job['sceneIndex'],
                'metadata': job_result.get('result', {}).get('metadata') if job_result.get('status') == 'finished' else None,
                'error': job_result.get('error') or (job_result.get('result', {}).get('error') if job_result.get('result') else None)
            })

    # Step 6: Call response summary agent
    print("\n=== Step 5: Generating Final Summary ===")
    from app.core.GenerateVideo.Generate_new.summary.response_summary import response_generator

    try:
        final_summary = await response_generator(
            scenes=scene_results,
            original_prompt=req.prompt
        )
        print(f"Summary generated: {final_summary}")
    except Exception as e:
        print(f"Error generating summary: {e}")
        final_summary = "Video generation completed."

    # Step 7: Update final response in MongoDB
    await ChatUpdater.update_final_response(
        chat_id=req.chatId,
        llm_response=final_summary
    )

    # Step 8: Notify API to deduct credits
    print("\n=== Step 6: Deducting Credits ===")
    import httpx
    from app.config.environment import API_BASE_URL

    try:
        async with httpx.AsyncClient() as client:
            credit_response = await client.post(
                f"{API_BASE_URL}/generatechat/complete",
                json={
                    'chatId': req.chatId,
                    'userId': req.userId,
                    'projectId': req.projectId,
                    'isEdited': False
                },
                timeout=30.0
            )
            
            if credit_response.status_code == 200:
                print("✓ Credits deducted successfully")
            else:
                print(f"⚠ Credit deduction failed: {credit_response.text}")
    except Exception as e:
        print(f"⚠ Error calling credit deduction API: {e}")

    # Step 9: Publish final completion event
    publish_event(req.chatId, "GENERATION_COMPLETE", {
        "message": "Video generation completed",
        "summary": final_summary,
        "scenesCompleted": len([s for s in scene_results if s.get('metadata')]),
        "scenesFailed": len([s for s in scene_results if s.get('error')]),
        "totalScenes": len(scene_results)
    })

    print(f"\n{'='*60}")
    print(f"ORCHESTRATION COMPLETE")
    print(f"Summary: {final_summary}")
    print(f"{'='*60}\n")
    
    return {
        "status": "success",
        "scenes_planned": len(planner_output),
        "scenes_coded": len(coder_output),
        "scenes_enqueued": len(job_ids),
        "job_ids": job_ids,
        "final_summary": final_summary,
        "results": scene_results
    }