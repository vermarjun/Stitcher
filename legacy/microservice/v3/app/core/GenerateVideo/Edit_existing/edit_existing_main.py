from pydantic import BaseModel
from .code_editor import coder_agent_wrapper
from app.utils.initialize_redis import get_scene_queue_manager
from .chat_updater import ChatUpdater
from app.utils.connect_mongo import mongodb
from bson import ObjectId


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
        coder_outputs = await coder_agent_wrapper(assets=assets, prompt=req.prompt)
        
        if not coder_outputs or len(coder_outputs) == 0:
            raise Exception("Code editor failed to generate output")
        
        edited_scene = coder_outputs[0]
        print(f"✓ Generated edited scene: {edited_scene['sceneName']}\n")
        
        # Step 3: Update MongoDB with generated code
        print("=== Step 3: Updating Generated Code ===")
        await ChatUpdater.update_generator_output(
            chat_id=req.chatId,
            scene_name=edited_scene["sceneName"],
            scene_description=edited_scene["sceneDescription"],
            code=edited_scene["code"]
        )
        print("✓ Code updated in MongoDB\n")
        
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
        
        print(f"{'='*60}")
        print("VIDEO EDIT WORKFLOW INITIATED")
        print(f"Job ID: {job_id}")
        print(f"Status: Queued for rendering")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "jobId": job_id,
            "sceneName": edited_scene["sceneName"],
            "status": "queued",
            "message": "Scene queued for rendering"
        }
        
    except Exception as e:
        print(f"\n{'='*60}")
        print("CRITICAL ERROR IN EDIT WORKFLOW")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\n")
        
        try:
            await ChatUpdater.update_final_response(
                chat_id=req.chatId,
                llm_response=f"I encountered a critical error: {str(e)}"
            )
        except:
            pass
        raise