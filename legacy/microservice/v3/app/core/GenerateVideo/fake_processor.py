"""
Fake Processor for Cached Examples

This module simulates the real video generation pipeline for cached example prompts.
It mimics the timing, SSE events, and database updates of the real flow but uses
pre-generated results from the cache instead of actual processing.
"""

import asyncio
from typing import Dict, Any
from app.utils.event_publisher import publish_event
from app.core.GenerateVideo.Generate_new.chat_updater import ChatUpdater



async def process_cached_example(req: Any, cached_data: Dict[str, Any]):
    """
    Process a cached example by simulating the real generation pipeline.
    
    This function:
    1. Publishes SSE events at each stage (planning, code gen, rendering)
    2. Updates MongoDB exactly like the real pipeline would
    3. Adds realistic delays to simulate processing time
    4. Deducts credits at the end
    
    Args:
        req: GenerateVideoRequest object with userId, chatId, projectId, etc.
        cached_data: Pre-generated data from EXAMPLE_CACHE
    """
    try:
        print(f"\\n{'='*60}")
        print(f"FAKE PROCESSOR STARTED - Cached Example")
        print(f"User: {req.userName} ({req.userId})")
        print(f"Chat: {req.chatId}")
        print(f"{'='*60}\\n")
        
        # ===================================================================
        # Step 1: Simulate Planning (3 seconds)
        # ===================================================================
        print("\\n=== Step 1: Simulating Planning ===")
        publish_event(req.chatId, "PLANNING_START", {
            "message": "Started planning scenes..."
        })
        
        # Simulate planning time
        await asyncio.sleep(3)
        
        # Convert cached planner output to SceneObject format
        from app.core.GenerateVideo.Generate_new.scenePlanner import Scene
        planner_objects = [
            Scene(
                SceneName=scene["SceneName"],
                Prompt=scene["Prompt"],
                RequiredMObjects=scene.get("RequiredMObjects", []),
                RequiredAnimations=scene.get("RequiredAnimations", [])
            )
            for scene in cached_data["planner_output"]
        ]
        
        # Update DB with planner output
        await ChatUpdater.update_planner_output(
            chat_id=req.chatId,
            planner_summary=cached_data["planner_summary"],  # Use cached summary
            scenes=planner_objects
        )
        
        publish_event(req.chatId, "PLANNING_COMPLETE", {
            "message": f"Planned {len(planner_objects)} scenes",
            "sceneCount": len(planner_objects)
        })
        
        print(f"Planning complete: {len(planner_objects)} scenes planned")
        
        publish_event(req.chatId, "SUMMARY_COMPLETE", {
            "summary": cached_data["planner_summary"],
            "sceneCount": 1
        })

        # ===================================================================
        # Step 2: Simulate Code Generation (4 seconds)
        # ===================================================================
        print("\\n=== Step 2: Simulating Code Generation ===")
        publish_event(req.chatId, "GENERATING_CODE_START", {
            "message": "Generating code for scenes..."
        })
        
        # Simulate code generation time
        await asyncio.sleep(4)
        
        # Use cached code
        scenes_with_code = cached_data["scenes_with_code"]
        
        # Update DB with generator output
        await ChatUpdater.update_generator_output(
            chat_id=req.chatId,
            scenes_with_code=scenes_with_code
        )
        
        publish_event(req.chatId, "GENERATING_CODE_COMPLETE", {
            "message": "Code generation completed",
            "scenes": scenes_with_code
        })
        
        print(f"Code generation complete: {len(scenes_with_code)} scenes")
        
        # ===================================================================
        # Step 3: Simulate Rendering (3 seconds per scene)
        # ===================================================================
        print("\\n=== Step 3: Simulating Rendering ===")
        publish_event(req.chatId, "ENQUEUED_FOR_RENDERING", {
            "message": f"Enqueued {len(scenes_with_code)} scenes for rendering",
            "jobIds": []  # No real job IDs for cached examples
        })
        
        # Process each scene with delay
        for idx, scene_data in enumerate(scenes_with_code):
            scene_name = scene_data["sceneName"]
            print(f"Simulating render for scene {idx + 1}/{len(scenes_with_code)}: {scene_name}")
            
            # Simulate rendering time
            await asyncio.sleep(3)
            
            # Get cached metadata for this scene (by index)
            if idx < len(cached_data["cloudinary_metadata"]):
                metadata = cached_data["cloudinary_metadata"][idx]
            else:
                print(f"Warning: No cached metadata for scene index {idx}")
                continue

            
            # Update DB with rendered scene (including asset creation)
            await ChatUpdater.update_scene_render(
                chat_id=req.chatId,
                scene_name=scene_name,
                code=scene_data["code"],
                scene_description=scene_data["description"],
                project_id=req.projectId,
                metadata=metadata  # Cloudinary URLs and metadata
            )
            
            # Publish scene completion event (matching real worker event name)
            publish_event(req.chatId, "RENDER_SUCCESS", {
                "message": f"Scene {scene_name} rendered",
                "sceneName": scene_name,
                "sceneIndex": idx,
                "metadata": metadata
            })
            
            print(f"✓ Scene {scene_name} render simulated")
        
        # ===================================================================
        # Step 4: Update Final Response (includes credit deduction)
        # ===================================================================
        print("\\n=== Step 4: Updating Final Response ===")
        
        # Note: ChatUpdater.update_final_response() handles credit deduction internally
        await ChatUpdater.update_final_response(
            chat_id=req.chatId,
            llm_response=cached_data["final_summary"]
        )
        
        print("✓ Final response updated (credits deducted by ChatUpdater)")
        
        # ===================================================================
        # Step 5: Publish Final Completion Event
        # ===================================================================
        publish_event(req.chatId, "GENERATION_COMPLETE", {
            "message": "Video generation completed",
            "summary": cached_data["final_summary"],
            "scenesCompleted": len(scenes_with_code),
            "scenesFailed": 0,
            "totalScenes": len(scenes_with_code)
        })
        
        print(f"\\n{'='*60}")
        print(f"FAKE PROCESSOR COMPLETED")
        print(f"Chat: {req.chatId}")
        print(f"Scenes: {len(scenes_with_code)}")
        print(f"{'='*60}\\n")
        
    except Exception as e:
        print(f"\\n{'='*60}")
        print(f"FAKE PROCESSOR ERROR")
        print(f"Chat: {req.chatId}")
        print(f"Error: {str(e)}")
        print(f"{'='*60}\\n")
        
        # Publish error event
        publish_event(req.chatId, "GENERATION_ERROR", {
            "message": "An error occurred during processing",
            "error": str(e)
        })
        
        raise
