from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from typing import List
from .scenePlanner import Scene
from openai import AsyncOpenAI
import asyncio
from app.utils.initialize_redis import get_redis_manager

class OutputSchema(BaseModel):
    code: str

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
    prompt = (
        f"You have to write the simplest possible code which keeps things minimal, does not break and does what is asked with minimum possible lines of code. Do not include comments in the output code."
        f"Generate python code for manim-community version v0.19.0 to implement this: {Scene.Prompt}. "
        f"Name the Scene class as: {Scene.SceneName}. "
        f"Use Black as the background color. "
        f"End the scene with a Fade transition. Ex: self.wait(2)\n self.play(FadeOut(*self.mobjects)). "
    )

    # Get least used API key from Redis
    redis_manager = get_redis_manager()
    api_config = redis_manager.get_least_used_api_key()

    if not api_config:
        raise Exception("No API keys available in the heap")
    
    email = api_config["email"]
    api_key = api_config["api_key"]
    base_url = api_config["base_url"]
    model_name = api_config["model"]
    current_tokens = api_config.get("tokens_used", 0)

    print(f"Using API key for: {email} with {current_tokens} tokens used")

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
        
        tokens_used_in_request = 0
        if result.context_wrapper.usage:
            tokens_used_in_request = result.context_wrapper.usage.total_tokens
        
        # Update token usage
        new_total_tokens = current_tokens + tokens_used_in_request
        redis_manager.update_token_usage(email, new_total_tokens)
        
        print(f"Updated token usage for {email}: {new_total_tokens}")
        
        return result.final_output.code
        
    except Exception as e:
        print(f"Error occurred, returned API key for {email} to heap")
        raise e
    
    finally:
        # Return the API key to heap even if there's an error
        redis_manager.return_api_key(email, current_tokens)

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