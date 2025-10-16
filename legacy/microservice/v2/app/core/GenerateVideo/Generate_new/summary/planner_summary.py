import asyncio
from typing import List, Dict, Union
from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from utils.model_provider import get_model
from core.GenerateVideo.Generate_new.chat_updater import ChatUpdater

class VideoSummary(BaseModel):
    summary: str

class SceneObject(BaseModel):
    SceneName: str
    Prompt: str

SUMMARIZER_SYSTEM_PROMPT = """You are a video generation summary specialist. Your task is to create a concise, engaging summary of the video generation plan that helps users understand what their video will contain.
Given a list of scenes with their names and prompts, create a clear summary that:
1. Captures the essence and flow of the entire video
2. Highlights the key elements and transitions between scenes
3. Uses natural, engaging language that's easy to understand
CRITICAL REQUIREMENTS:
- Keep your summary under 200 words (approximately 3-4 sentences)
- Focus on the overall narrative and visual journey
- Avoid listing scenes - instead describe the flow and content naturally
- Make it informative yet concise"""

summarizer_agent = Agent(
    name="Video Summary Generator",
    instructions=SUMMARIZER_SYSTEM_PROMPT,
    model="SUMMARIZER",
    output_type=VideoSummary
)

def normalize_scene(scene: Union[Dict, object]) -> SceneObject:
    """Convert Scene object or dict to a standardized SceneObject"""
    if isinstance(scene, dict):
        return SceneObject(
            SceneName=scene.get('SceneName', scene.get('sceneName', 'Unknown')),
            Prompt=scene.get('Prompt', scene.get('prompt', ''))
        )
    # Handle Pydantic model or object with attributes
    return SceneObject(
        SceneName=getattr(scene, 'SceneName', getattr(scene, 'sceneName', 'Unknown')),
        Prompt=getattr(scene, 'Prompt', getattr(scene, 'prompt', ''))
    )

async def summarizer_agent_function(planner_output: List[Union[Dict, object]]) -> str:
    try:
        # Normalize all scenes to SceneObject format
        scenes = [normalize_scene(scene) for scene in planner_output]
        
        # Format the planner output for the LLM
        scenes_text = "\n".join([
            f"Scene {i+1} ({scene.SceneName}): {scene.Prompt}"
            for i, scene in enumerate(scenes)
        ])
        
        user_prompt = f"""Summarize this video generation plan in under 200 words (3-4 sentences). Focus on the overall flow and key visual elements:
{scenes_text}
Create a concise, engaging summary that captures the essence of this video."""
        
        # Get the model
        summarizer_model = get_model("GENERAL")
        
        result = await Runner.run(
            summarizer_agent,
            user_prompt,
            run_config=RunConfig(model=summarizer_model)
        )
        
        summary = result.final_output.summary
        print(f"✓ Summarizer agent completed: {len(summary.split())} words")
        return summary
        
    except Exception as e:
        print(f"Error in summarizer agent: {e}")
        # Fallback to a basic summary
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes[:3]]
        return f"Your video will contain {len(planner_output)} scenes covering: {', '.join(scene_names)}{'...' if len(planner_output) > 3 else ''}."

async def summarizer_agent_wrapper(
    chat_id: str,
    planner_output: List[Union[Dict, object]]
):
    """
    Wrapper that calls summarizer agent and updates MongoDB
    This runs asynchronously to not block the main flow
    
    Args:
        chat_id: MongoDB chat document ID
        planner_output: List of Scene objects or {sceneName, prompt} dictionaries
    """
    try:
        print(f"Starting summarizer agent for chat {chat_id}...")
        
        # Get summary from LLM
        summary = await summarizer_agent_function(planner_output)
        
        # Normalize scenes to SceneObject format for MongoDB storage
        normalized_scenes = [normalize_scene(scene) for scene in planner_output]
        
        # Update MongoDB with planner output and scenes
        await ChatUpdater.update_planner_output(
            chat_id=chat_id,
            planner_summary=summary,
            scenes=normalized_scenes
        )
        
        print(f"✓ Summarizer wrapper completed for chat {chat_id}")
        
    except Exception as e:
        print(f"Error in summarizer wrapper: {e}")
        # Update with a basic summary even if LLM fails
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes]
        await ChatUpdater.update_planner_output(
            chat_id=chat_id,
            planner_summary=f"Video generation plan created with {len(planner_output)} scenes: {', '.join(scene_names)}.",
            scenes=scenes
        )