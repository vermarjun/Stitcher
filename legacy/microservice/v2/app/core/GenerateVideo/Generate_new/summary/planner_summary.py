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

SUMMARIZER_SYSTEM_PROMPT = """
You are plan summarizer agent. Your job is to summarize the plans made by other agents. You are provided with an 
array of Scenes where each Scene has a SceneName and it's description. You have to summarize entire thing to a human.
You have to explain in short: 
1. How many scenes are planned.
2. Scene Name
3. What each scene has to explain
4. What the user can expect when these scenes are rendered independently and merged as a single video as output

You have to just brief the user about intensions and plans of the planner agent, whose plan is given to you and you have 
to give a summary of that plan as an output;

CRITICAL REQUIREMENTS:
- Use a natural and engaging language which is conforting attracting and soothing to read, 
- Keep your summary under 80 words at max. 
- Focus on the overall narrative and visual journey
"""

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

        print("This is what is given as input to planner_summary: ",scenes_text)

        # Get the model
        summarizer_model = get_model("GENERAL")
        
        result = await Runner.run(
            summarizer_agent,
            scenes_text,
            run_config=RunConfig(model=summarizer_model)
        )
        
        summary = result.final_output.summary
        # print(f"✓ Summarizer agent completed: {len(summary.split())} words")
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
    try:
        # print(f"Starting summarizer agent for chat {chat_id}...")
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
        # print(f"✓ Summarizer wrapper completed for chat {chat_id}")
        
    except Exception as e:
        print(f"Error in summarizer wrapper: {e}")

        # Update with a basic summary if agent fails
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes]
        await ChatUpdater.update_planner_output(
            chat_id=chat_id,
            planner_summary=f"Video generation plan created with {len(planner_output)} scenes: {', '.join(scene_names)}.",
            scenes=scenes
        )