from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from typing import List
from app.utils.initialize_redis import get_planner_heap_manager, fetch_api_key_with_queue
from openai import AsyncOpenAI

import json
import os

class Scene(BaseModel):
    SceneName: str
    Prompt: str
    RequiredMObjects: List[str]
    RequiredAnimations: List[str]

OutputSchema = List[Scene]

# Load toolboxes
current_dir = os.path.dirname(os.path.abspath(__file__))
# Navigate up to app/docs
docs_dir = os.path.join(current_dir, "../../../docs")

with open(os.path.join(docs_dir, "manim_animation_toolbox.json"), "r") as f:
    animation_toolbox = json.load(f)

with open(os.path.join(docs_dir, "manim_mobject_toolbox.json"), "r") as f:
    mobject_toolbox = json.load(f)

planner_agent = Agent(
    name="Script Generator",
    instructions = (f"""
You are an expert Manim animation planner. Your job is to break down user prompts into 1-8 simple, 
independent scenes. Each scene will be rendered separately by a code generator that has NO context 
of other scenes.
You have access to the following MObjects and Animations toolboxes. 
For each scene, you must strictly identify and list the MObjects and Animations required from these toolboxes.

MObjects Toolbox:
{json.dumps(mobject_toolbox['mobjects'], indent=2)}

Animations Toolbox:
{json.dumps(animation_toolbox['animations'], indent=2)}

═══════════════════════════════════════════════════════════════════════════════
YOUR PLANNING PROCESS:
═══════════════════════════════════════════════════════════════════════════════

1. **Analyze the user request** and identify key concepts to visualize

2. **Break into scenes (1-8 scenes max)**:
   - Scene 1: ALWAYS start with the simplest possible opening scene
   - Keep each scene focused on ONE clear concept
   - Try to use minimum number of scenes possible. 

3. **For EACH scene, you MUST specify**:
   - **SceneName**: Clear, descriptive name
   - **Prompt**: Detailed description of what appears on screen (see requirements below)
   - **RequiredMObjects**: List of EXACT MObject class names from the toolbox (e.g., ["Text", "Circle", "Arrow"])
   - **RequiredAnimations**: List of EXACT Animation class names from the toolbox (e.g., ["Write", "FadeIn", "Transform"])

═══════════════════════════════════════════════════════════════════════════════
SCENE PROMPT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════════════════

Your scene prompts must be CONCRETE and SPECIFIC:

✅ GOOD: "Create a blue Circle with radius 2. Use Create animation to draw it. Wait 1 second. 
          Then use FadeOut to remove it."
❌ BAD: "Show a circle and make it disappear" (too vague)

✅ GOOD: "Display Text 'Quick Sort' at the top using Write animation. Below it, create 5 Rectangles 
          representing array elements. Use FadeIn for each rectangle with lag_ratio=0.2."
❌ BAD: "Introduce the quick sort title and array" (no specific objects or animations)

═══════════════════════════════════════════════════════════════════════════════
STRUCTURE YOUR SCENE PROMPTS:
═══════════════════════════════════════════════════════════════════════════════

Each scene prompt should follow this pattern:

1. **Objects to create**: Name EXACT MObject classes from the toolbox
   - Specify all parameters: size, color, position, text content, etc.
   
2. **Animations to use**: Pick EXACT Animation classes from the toolbox
   - Specify animation parameters: run_time, lag_ratio, scale_factor, etc.
   
3. **Timing**: Include Wait() durations between actions
   
4. **Layout**: Specify positions using constants (UP, DOWN, LEFT, RIGHT, CENTER) or coordinates

═══════════════════════════════════════════════════════════════════════════════
CRITICAL CONSTRAINTS:
═══════════════════════════════════════════════════════════════════════════════

- NEVER reference "previous scene" or "next scene" in any prompt
- Each scene is 100% self-contained and independent
- Keep animations MINIMAL - don't overcomplicate
- Prefer static displays over complex animations
- Maximum 3-4 animation actions per scene
- Always specify exact MObject types and Animation classes from the toolboxes
- ONLY use MObjects and Animations that exist in the toolboxes provided


═══════════════════════════════════════════════════════════════════════════════
IMPORTANT: Always populate RequiredMObjects and RequiredAnimations lists with EXACT class names 
from the toolboxes. This helps the code generator know exactly which imports and examples to use.
═══════════════════════════════════════════════════════════════════════════════

Now plan the scenes based on the user's request. Remember to consult the toolboxes and list the 
exact MObject and Animation classes needed for each scene.
"""),
    output_type=OutputSchema
)


async def planner_agent_function(prompt: str):
    print("planner model called!")

    # Get least used API key from Planner Heap (medium models)
    planner_heap_manager = get_planner_heap_manager()
    
    api_config = await fetch_api_key_with_queue(
        planner_heap_manager,
        timeout=300  # 5 minutes max wait
    )
    
    email = api_config["email"]
    api_key = api_config["api_key"]
    base_url = api_config["base_url"]
    model_name = api_config["model"]
    current_tokens = api_config.get("tokens_used", 0)

    print(f"Using API key for: {email} with {current_tokens} tokens used")
    
    tokens_used_in_request = 0
    try:
        # Create OpenAI client with the retrieved config
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        planner_agent.model = OpenAIChatCompletionsModel(model=model_name, openai_client=client)

        # Run the planner agent with the custom model
        result = await Runner.run(
            planner_agent, 
            prompt
        )
        
        if result.context_wrapper.usage:
            tokens_used_in_request = result.context_wrapper.usage.total_tokens
        
        return result.final_output
        
    except Exception as e:
        print(f"Error occurred, returned API key for {email} to heap")
        raise e
    
    finally:
        # Return the API key to planner heap with updated token count
        new_total_tokens = current_tokens + tokens_used_in_request
        planner_heap_manager.update_token_usage(email, new_total_tokens)
        print(f"Returned API key for {email} to planner heap. New token usage: {new_total_tokens}")