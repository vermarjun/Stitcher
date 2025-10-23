from pydantic import BaseModel
from typing import Optional, Dict, Any
from core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from core.GenerateVideo.render_and_upload import render_and_upload_manim
from .code_editor import coder_agent_wrapper
from core.GenerateVideo.Generate_new.summary.response_summary import response_generator
from utils.model_provider import MultiTenantModelManager
from .chat_updater import ChatUpdater
from utils.connect_mongo import mongodb
from bson import ObjectId

class CoderOutput(BaseModel):
    code: str
    sceneName: str 
    sceneDescription: str

class RequestSchema(BaseModel):
    userName: str
    prompt: str
    projectId: str
    userId: str
    assetId: list[str]
    chatId: str

async def debug_render_upload(
    coder_output: CoderOutput, 
    req: RequestSchema, 
    chat_id: str, 
    project_id: str
) -> Dict[str, Any]:
    
    for attempt in range(3):
        print(f"\nAttempt {attempt + 1}/3 for scene: {coder_output.sceneName}")
        
        result = render_and_upload_manim(
            code=coder_output.code, 
            scene_name=coder_output.sceneName, 
            public_id=req.userId
        )
        
        if result["success"]:
            print(f"✓ Successfully rendered and uploaded: {coder_output.sceneName}")
            
            await ChatUpdater.update_scene_render(
                code=coder_output.code,
                chat_id=chat_id,
                scene_name=coder_output.sceneName,
                scene_description=coder_output.sceneDescription,
                project_id=project_id,
                metadata=result["metadata"]
            )
            
            return {
                "code": coder_output.code,
                "sceneName": coder_output.sceneName,
                "sceneDescription": coder_output.sceneDescription,
                "metadata": result["metadata"],
                "error": None,
                "success": True
            }
        else:
            error_msg = result["error"]
            print(f"✗ Render failed for {coder_output.sceneName}: {error_msg}")
            
            if attempt < 2:
                print(f"🔧 Debugging {coder_output.sceneName}...")
                try:
                    fixed_code = await debugger_agent_wrapper(coder_output.code, error_msg)
                    coder_output.code = fixed_code
                    
                    await ChatUpdater.update_scene_code(
                        chat_id=chat_id,
                        scene_name=coder_output.sceneName,
                        scene_description=coder_output.sceneDescription,
                        new_code=fixed_code
                    )
                except Exception as debug_error:
                    print(f"Debugger failed: {debug_error}")
                    if attempt == 2:
                        break
            else:
                print(f"✗ Final failure after 3 attempts for {coder_output.sceneName}")
                await ChatUpdater.update_scene_error(
                    chat_id=chat_id,
                    scene_name=coder_output.sceneName,
                    error=error_msg
                )
                
                return {
                    "code": coder_output.code,
                    "sceneName": coder_output.sceneName,
                    "sceneDescription": coder_output.sceneDescription,
                    "metadata": None,
                    "error": error_msg,
                    "success": False
                }
    
    return {
        "code": coder_output.code,
        "sceneName": coder_output.sceneName,
        "sceneDescription": coder_output.sceneDescription,
        "metadata": None,
        "error": "Failed after 3 attempts",
        "success": False
    }

async def edit_existing_main(req: RequestSchema, api_config: dict):
    async with MultiTenantModelManager.request_scope(api_config):
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
            
            # Step 4: Debug, render and upload
            print("=== Step 4: Rendering & Uploading ===")
            coder_output_obj = CoderOutput(
                code=edited_scene["code"],
                sceneName=edited_scene["sceneName"],
                sceneDescription=edited_scene["sceneDescription"]
            )
            
            final_result = await debug_render_upload(
                coder_output=coder_output_obj,
                req=req,
                chat_id=req.chatId,
                project_id=req.projectId
            )
            
            if not final_result["success"]:
                print(f"✗ Rendering failed: {final_result.get('error')}")
                llm_response = f"I encountered an error while rendering your edited video: {final_result.get('error', 'Unknown error')}"
            else:
                print("✓ Rendering successful\n")
                
                # Step 5: Generate final response summary
                print("=== Step 5: Generating Response Summary ===")
                try:
                    llm_response = await response_generator(
                        scenes=[final_result],
                        original_prompt=req.prompt
                    )
                    print("✓ Response summary generated")
                except Exception as e:
                    print(f"✗ Error generating response: {e}")
                    llm_response = "Your video has been successfully edited and rendered."
            
            # Step 6: Mark chat as complete
            print("\n=== Step 6: Finalizing ===")
            await ChatUpdater.update_final_response(
                chat_id=req.chatId,
                llm_response=llm_response
            )
            print("✓ Chat marked as completed\n")
            
            print(f"{'='*60}")
            print("VIDEO EDIT WORKFLOW COMPLETED")
            print(f"Success: {final_result['success']}")
            print(f"{'='*60}\n")
            
            return [final_result]
            
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