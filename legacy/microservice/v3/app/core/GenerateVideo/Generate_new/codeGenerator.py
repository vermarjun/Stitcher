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
    instructions=(
        """
# ROLE & TASK
You are a senior Python engineer with deep expertise in manim-community v0.19.0. \
Your sole task is to write clean, minimal, fully-executable Manim scene code based on the description provided. \
The output will be rendered directly by an automated pipeline — there is zero tolerance for broken code.

# CONTEXT
- Target library : manim-community v0.19.0 (NOT ManimGL, NOT older CE versions)
- Execution environment : headless render server; no user interaction, no manual fixes
- Downstream constraint : render time and file size are tightly bounded, so code complexity \
  must be kept to the absolute minimum needed to fulfil the scene description
- Audience for the video : general viewers who need clear, visually clean animations

# CONSTRAINTS (non-negotiable)
1. Use ONLY manim-community v0.19.0 APIs — never deprecated or ManimGL-only constructs
2. Background color MUST be BLACK (config.background_color = BLACK or equivalent)
3. Every scene MUST end with: self.wait(2) followed by self.play(FadeOut(*self.mobjects))
4. Zero code comments — none whatsoever
5. Minimum lines of code — do not add helper classes, extra methods, or any boilerplate \
   beyond what the scene strictly requires
6. Output is a single self-contained Python file — all imports from `manim` must be explicit

# OUTPUT FORMAT
Return a single Python code block. No prose, no markdown fences, no explanation — just the code.
"""
    ),
    output_type=OutputSchema
)

async def codeGenerator_agent_function(Scene: Scene):
    # Get relevant examples based on required lists
    knowledge_base = get_example_context(Scene.RequiredMObjects, Scene.RequiredAnimations)
    
    prompt = f"""
## SCENE SPECIFICATION

<scene_description>
{Scene.Prompt}
</scene_description>

<scene_class_name>
{Scene.SceneName}
</scene_class_name>

---

## RETRIEVED KNOWLEDGE BASE
The following reference material was retrieved from the Stitcher knowledge base \
specifically for the MObjects and Animations required by this scene. \
Treat these as the authoritative source for parameter names, defaults, and usage patterns. \
Do NOT guess signatures — if a parameter is not listed here, do not use it.

<knowledge_base>
{knowledge_base}
</knowledge_base>

---

## SELF-EVALUATION CHECKLIST
Before producing the final output, silently verify each item:
- [ ] Scene class is named exactly `{Scene.SceneName}`
- [ ] Every MObject and Animation used is present in the knowledge base above OR is a \
      well-known core primitive (Circle, Square, Text, Tex, VGroup, Arrow, Line, Dot)
- [ ] No deprecated APIs (e.g. ShowCreation → Create, DrawBorderThenFill is fine)
- [ ] Scene ends with `self.wait(2)` then `self.play(FadeOut(*self.mobjects))`
- [ ] Background is BLACK
- [ ] Zero comments in the code
- [ ] No extraneous imports beyond `from manim import *`

Only output the code once all checks pass.
"""

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