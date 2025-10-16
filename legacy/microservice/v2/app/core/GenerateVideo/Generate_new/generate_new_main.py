from pydantic import BaseModel
from core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from core.GenerateVideo.render_and_upload import render_and_upload_manim
from .summary.planner_summary import summarizer_agent_wrapper
from .summary.response_summary import response_generator
from .codeGenerator import generate_all_scenes
from .scenePlanner import planner_agent_function
from utils.model_provider import MultiTenantModelManager, get_model
from .chat_updater import ChatUpdater

async def debug_render_upload(Scene, req, chat_id: str, project_id: str):
    for attempt in range(3):
        result = render_and_upload_manim(
            code=Scene["code"], 
            scene_name=Scene["sceneName"], 
            public_id=req.userId
        )
        
        if result["success"]:
            print(f"Uploaded: {Scene['sceneName']}")
            
            await ChatUpdater.update_scene_render(
                chat_id=chat_id,
                scene_name=Scene["sceneName"],
                project_id=project_id,
                metadata=result["metadata"]
            )
            
            return {
                "code": Scene["code"],
                "sceneName": Scene["sceneName"],
                "metadata": result["metadata"],
                "error": None
            }
        else:
            error_msg = result["error"]
            print(f" Render failed for {Scene['sceneName']}: {error_msg}")

            if attempt < 2:
                # Debug and update code
                print(f"Debugging {Scene['sceneName']} (attempt {attempt + 1}/3)...")
                Scene["code"] = await debugger_agent_wrapper(Scene["code"], error_msg)
                
                # Update MongoDB with debugged code
                await ChatUpdater.update_scene_code(
                    chat_id=chat_id,
                    scene_name=Scene["sceneName"],
                    new_code=Scene["code"]
                )
            else:
                # Final failure - update with error
                await ChatUpdater.update_scene_error(
                    chat_id=chat_id,
                    scene_name=Scene["sceneName"],
                    error=error_msg
                )
                
                return {
                    "code": Scene["code"],
                    "sceneName": Scene["sceneName"],
                    "metadata": None,
                    "error": error_msg
                }

class RequestSchema(BaseModel):
    prompt: str 
    userId: str
    chatId: str
    projectId: str
    userName: str

async def generate_new_video_main(req: RequestSchema, api_config: dict):

    async with MultiTenantModelManager.request_scope(api_config):
        
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
        
        print("Summarizer agent started in background")

        # Step 2: Generate code for each scene
        print("\n=== Step 2: Generating Code ===")
        coder_output = await generate_all_scenes(Scenes=planner_output) 
        print(f"Code generation completed: {len(coder_output)} scenes")
        print("Generated results:", coder_output)

        # Step 2.5: Update MongoDB with generator output
        print("\n=== Step 2.5: Updating Generator Output ===")
        scenes_with_code = [
            {
                "sceneName": scene["sceneName"],
                "code": scene["code"]
            }
            for scene in coder_output
        ]
        await ChatUpdater.update_generator_output(
            chat_id=req.chatId,
            scenes_with_code=scenes_with_code
        )
        print("Generator output updated in MongoDB")

        # Step 3: Debug, render and upload each scene
        print("\n=== Step 3: Rendering Scenes ===")
        final_results = []

        for idx, scene in enumerate(coder_output, 1):
            print(f"\n--- Rendering Scene {idx}/{len(coder_output)}: {scene['sceneName']} ---")
            result = await debug_render_upload(
                Scene=scene, 
                req=req,
                chat_id=req.chatId,
                project_id=req.projectId
            )
            print(f"Scene {scene['sceneName']} processing complete")
            final_results.append(result)
        
        print("\n=== Step 4: All Scenes Processed ===")

        # Step 4: Generate final response summary
        print("\n=== Step 5: Generating Final Response ===")
        try:
            llm_response = await response_generator(
                scenes=final_results,
                original_prompt=req.prompt
            )
            print("Final response generated")
        except Exception as e:
            print(f"Error generating final response: {e}")
            llm_response = "Video generation completed."

        # Step 5: Update MongoDB with final response and mark complete
        print("\n=== Step 6: Marking Chat Complete ===")
        await ChatUpdater.update_final_response(
            chat_id=req.chatId,
            llm_response=llm_response
        )
        print("Chat marked as completed in MongoDB")
        
        print("\n=== Video Generation Complete ===")
        print(f"Total scenes: {len(final_results)}")
        successful = sum(1 for r in final_results if r.get("metadata"))
        print(f"Successful: {successful}")
        print(f"Failed: {len(final_results) - successful}")
        
        return final_results