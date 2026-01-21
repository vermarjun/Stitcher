from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from typing import List
from .scenePlanner import Scene
from openai import AsyncOpenAI
import asyncio
from app.utils.initialize_redis import get_coder_heap_manager, fetch_api_key_with_queue
from app.docs.mObject_examples import CODE_SNIPPETS as MOBJECT_EXAMPLES
from app.docs.animation_examples import CODE_SNIPPETS as ANIMATION_EXAMPLES
import re

class OutputSchema(BaseModel):
    code: str

def clean_name(name: str) -> str:
    """Converts name to lowercase and removes spaces."""
    return name.lower().replace(" ", "")

def get_example_context(required_mobjects: List[str], required_animations: List[str]) -> str:
    context = []
    
    # Process MObjects
    if required_mobjects:
        context.append("MOBJECT EXAMPLES AND PARAMETERS:")
        for mob in required_mobjects:
            clean_mob = clean_name(mob)
            if clean_mob in MOBJECT_EXAMPLES:
                data = MOBJECT_EXAMPLES[clean_mob]
                context.append(f"\n--- {mob} ---")
                context.append("Parameters:")
                context.append(str(data.get("parameters", {})))
                context.append("Examples:")
                for ex in data.get("examples", []):
                    context.append(ex)
    
    # Process Animations
    if required_animations:
        context.append("\nANIMATION EXAMPLES AND PARAMETERS:")
        for anim in required_animations:
            clean_anim = clean_name(anim)
            if clean_anim in ANIMATION_EXAMPLES:
                data = ANIMATION_EXAMPLES[clean_anim]
                context.append(f"\n--- {anim} ---")
                context.append("Parameters:")
                context.append(str(data.get("parameters", {})))
                context.append("Examples:")
                for ex in data.get("examples", []):
                    context.append(ex)
                    
    return "\n".join(context)

code_generator_agent = Agent(
    name="Manim Code Generator",
    instructions = ("""
                You are an expert Python developer specializing in manim-community v0.19.0.
                Always generate valid Python code that is compatible with manim-community v0.19.0. 
                Always make sure that you do not use deprecated APIs or features from older versions of manim. 
                You have to write simplest possible Python Manim v0.19.0 code which does what user says in minimum lines of code with simplest possible approach
                Do not add comments in the code you write, No comments at all 
                Keep the scenes simple and small, try to do what user wants with minimum complexity for smaller codes and faster renders with manim community v0.19.0
"""),
    output_type=OutputSchema
)

async def codeGenerator_agent_function(Scene: Scene):
    # Get relevant examples based on required lists
    knowledge_base = get_example_context(Scene.RequiredMObjects, Scene.RequiredAnimations)
    
    prompt = (
        f"You have to write the simplest possible code which keeps things minimal, does not break and does what is asked with minimum possible lines of code. Do not include comments in the output code."
        f"Generate python code for manim-community version v0.19.0 to implement this: {Scene.Prompt}. "
        f"Name the Scene class as: {Scene.SceneName}. "
        f"Use Black as the background color. "
        f"End the scene with a Fade transition. Ex: self.wait(2)\n self.play(FadeOut(*self.mobjects)). "
        f"\n\nHere is the KNOWLEDGE BASE containing relevant parameters and examples for the MObjects and Animations used in this scene. USE THIS KNOWLEDGE BASE to ensure correct usage and avoid hallucinations:\n"
        f"{knowledge_base}"
    )

    # Get least used API key from Coder Heap (big models)
    coder_heap_manager = get_coder_heap_manager()
    api_config = await fetch_api_key_with_queue(
        coder_heap_manager,
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
        
        code_generator_agent.model = OpenAIChatCompletionsModel(model=model_name, openai_client=client)


        # Run the planner agent with the custom model
        result = await Runner.run(
            code_generator_agent, 
            prompt
        )
        
        if result.context_wrapper.usage:
            tokens_used_in_request = result.context_wrapper.usage.total_tokens
        
        return result.final_output.code
        
    except Exception as e:
        print(f"Error occurred, returned API key for {email} to heap")
        raise e
    
    finally:
        # Return the API key to coder heap with updated token count
        new_total_tokens = current_tokens + tokens_used_in_request
        coder_heap_manager.update_token_usage(email, new_total_tokens)
        print(f"Returned API key for {email} to coder heap. New token usage: {new_total_tokens}")

async def generate_all_scenes(Scenes: List[Scene], max_concurrency: int = 4, per_scene_timeout: int = 120):
    sem = asyncio.Semaphore(max_concurrency)

    async def _worker(scene: Scene):
        await sem.acquire()
        try:
            try:
                code = await asyncio.wait_for(codeGenerator_agent_function(scene), timeout=per_scene_timeout)
                return {"code": code, "sceneName": scene.SceneName, "description": scene.Prompt, "error": None}
            except asyncio.TimeoutError:
                return {"code": None, "sceneName": scene.SceneName, "description": scene.Prompt, "error": "timeout"}
            except Exception as e:
                return {"code": None, "sceneName": scene.SceneName, "description": scene.Prompt, "error": str(e)}
        finally:
            sem.release()

    # create tasks in same order as input so gather preserves order
    tasks = [asyncio.create_task(_worker(s)) for s in Scenes]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return results