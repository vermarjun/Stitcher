from pydantic import BaseModel
from .code_editor import coder_agent_wrapper
from app.utils.initialize_redis import get_scene_queue_manager
from .chat_updater import ChatUpdater
from app.utils.connect_mongo import mongodb
from bson import ObjectId
from app.utils.event_publisher import publish_event
from app.utils.job_tracker import JobCompletionTracker
import httpx
from app.config.environment import API_BASE_URL


class EditVideoRequest(BaseModel):
    userName: str
    prompt: str
    projectId: str
    userId: str
    assetId: list[str]
    chatId: str

class CoderOutput(BaseModel):
    code: str
    sceneName: str 
    sceneDescription: str

async def edit_existing_main(req: EditVideoRequest):
    try:
        print(f"\n{'='*60}")
        print("STARTING VIDEO EDIT WORKFLOW")
        print(f"Chat ID: {req.chatId}")
        print(f"Project ID: {req.projectId}")
        print(f"Assets to edit: {len(req.assetId)}")
        print(f"{'='*60}\n")
        
        # Step 1: Fetch assets from database
        print("=== Step 1: Fetching Assets ===")
        publish_event(req.chatId, "EDITING_START", {"message": "Fetching assets to edit..."})
        
        db = await mongodb.get_db()
        assets_collection = db.assets
        
        assets = []
        for asset_id_str in req.assetId:
            try:
                asset = await assets_collection.find_one({"_id": ObjectId(asset_id_str)})
                if asset:
                    assets.append(asset)
                    print(f"Fetched asset: {asset.get('name', 'Unknown')}")
                else:
                    print(f"Asset not found: {asset_id_str}")
            except Exception as e:
                print(f"Error fetching asset {asset_id_str}: {e}")
        
        if not assets:
            raise Exception("No valid assets found to edit")
        
        print(f"Total assets fetched: {len(assets)}\n")
        
        # Step 2: Generate edited code
        print("=== Step 2: Generating Edited Code ===")
        publish_event(req.chatId, "EDITING_CODE_START", {"message": "Generating edited code..."})
        
        coder_outputs = await coder_agent_wrapper(assets=assets, prompt=req.prompt)
        
        if not coder_outputs or len(coder_outputs) == 0:
            raise Exception("Code editor failed to generate output")
        
        edited_scene = coder_outputs[0]
        print(f"✓ Generated edited scene: {edited_scene['sceneName']}\n")
        
        publish_event(req.chatId, "EDITING_CODE_COMPLETE", {
            "message": "Code generation completed",
            "sceneName": edited_scene["sceneName"]
        })
        
        # Step 3: Update MongoDB with generated code
        print("=== Step 3: Updating Generated Code ===")
        await ChatUpdater.update_generator_output(
            chat_id=req.chatId,
            scene_name=edited_scene["sceneName"],
            scene_description=edited_scene["sceneDescription"],
            code=edited_scene["code"]
        )
        print("✓ Code updated in MongoDB\n")
        
        # Step 4: Enqueue rendering job
        print("=== Step 4: Enqueuing Rendering Job ===")
        queue_manager = get_scene_queue_manager()

        scene_data = {
            'sceneName': edited_scene["sceneName"],
            'code': edited_scene["code"],
            'description': edited_scene["sceneDescription"]
        }

        job_id = queue_manager.enqueue_scene(
            scene_data=scene_data,
            project_id=req.projectId,
            user_id=req.userId,
            chat_id=req.chatId,
            scene_index=0,  # Single edited scene
            is_edited=True  # CRITICAL: This ensures worker uses edit ChatUpdater
        )

        print(f"✓ Rendering job enqueued with ID: {job_id}\n")
        
        publish_event(req.chatId, "ENQUEUED_FOR_RENDERING", {
            "message": "Enqueued for rendering",
            "jobId": job_id
        })
        
        # Step 5: Wait for job completion
        print("=== Step 5: Waiting for Job Completion ===")
        tracker = JobCompletionTracker(queue_manager.redis)
        
        # Wait for the job to complete (blocks here until done)
        job_results = await tracker.wait_for_jobs([job_id], poll_interval=5, timeout=1800)
        
        print(f"Job completed. Result: {job_results}")
        
        # Step 6: Generate response summary
        print("=== Step 6: Generating Final Summary ===")
        from app.core.GenerateVideo.Generate_new.summary.response_summary import response_generator
        
        # Prepare scene result for summary
        job_result = job_results[0] if job_results else None
        scene_result = {
            'sceneName': edited_scene["sceneName"],
            'sceneIndex': 0,
            'metadata': job_result.get('result', {}).get('metadata') if job_result and job_result.get('status') == 'finished' else None,
            'error': job_result.get('error') or (job_result.get('result', {}).get('error') if job_result and job_result.get('result') else None)
        }
        
        try:
            final_summary = await response_generator(
                scenes=[scene_result],
                original_prompt=req.prompt
            )
            print(f"Summary generated: {final_summary}")
        except Exception as e:
            print(f"Error generating summary: {e}")
            if scene_result.get('metadata'):
                final_summary = f"I have successfully edited your video based on your request: '{req.prompt}'. The edited scene has been rendered and is ready."
            else:
                final_summary = f"I attempted to edit your video for '{req.prompt}', but encountered an issue during rendering: {scene_result.get('error', 'Unknown error')}."
        
        # Step 7: Update final response in MongoDB
        await ChatUpdater.update_final_response(
            chat_id=req.chatId,
            llm_response=final_summary
        )
        
        # Step 8: Notify API to deduct credits
        print("=== Step 7: Deducting Credits ===")
        try:
            async with httpx.AsyncClient() as client:
                credit_response = await client.post(
                    f"{API_BASE_URL}/generatechat/complete",
                    json={
                        'chatId': req.chatId,
                        'userId': req.userId,
                        'projectId': req.projectId,
                        'isEdited': True
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
        publish_event(req.chatId, "EDITING_COMPLETE", {
            "message": "Video editing completed",
            "summary": final_summary,
            "success": scene_result.get('metadata') is not None,
            "error": scene_result.get('error')
        })
        
        print(f"\n{'='*60}")
        print("VIDEO EDIT WORKFLOW COMPLETE")
        print(f"Summary: {final_summary}")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "jobId": job_id,
            "sceneName": edited_scene["sceneName"],
            "status": "completed",
            "message": final_summary,
            "result": scene_result
        }
        
    except Exception as e:
        print(f"\n{'='*60}")
        print("CRITICAL ERROR IN EDIT WORKFLOW")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\n")
        
        # Publish error event
        publish_event(req.chatId, "EDITING_ERROR", {
            "message": f"Error during editing: {str(e)}",
            "error": str(e)
        })
        
        try:
            await ChatUpdater.update_final_response(
                chat_id=req.chatId,
                llm_response=f"I encountered a critical error while editing your video: {str(e)}"
            )
        except:
            pass
        raise