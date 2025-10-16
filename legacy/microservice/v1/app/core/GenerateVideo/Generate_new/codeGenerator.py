from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import Optional, List
from .scenePlanner import Scene
from utils.model_provider import get_model  

class GeneratorOutput(BaseModel):
    scene_name: str
    code: str

code_generator_agent = Agent(
    name="Manim Code Generator",
    instructions=(
        "You are an expert Python developer specializing in manim-community v0.19.0. "
        "Always generate valid Python code that is 100% compatible with manim-community v0.19.0. "
        "Do not use deprecated APIs or features from older versions of manim. "
        "The goal is to create educational, visually clear animations similar in style to 3Blue1Brown. "
        "Animations should be smooth, intuitive, and visually explanatory. "
        "Avoid sudden transitions, overlapping elements, or off-screen placements. "
        "Whenever displaying text, position it in unused screen areas to prevent collisions. "
        "For each request, you MUST create a fresh, complete Scene class. "
        "The class name MUST exactly match the requested SceneName. "
        "Do NOT include placeholder comments like 'continue from here' or 'add next animation'. "
        "If prior scenes are provided as context, use them ONLY to infer continuity, "
        "but never copy-paste them. Always regenerate the scene cleanly from scratch. "
        "The new scene generated is the continuation of previous code. "
        "Ensure the total duration does not exceed the given limit. "
        "Keep the scenes simple and small, try to do what user wants with minimum complexity for smaller codes and faster renders with manim community v0.19.0"
        "THE ONLY EXPECTED OUTPUT IS VALID PYTHON CODE."
    ),
    model="CODER",
    output_type=GeneratorOutput
)

async def code_gen_function(req: Scene, previous_code: Optional[str] = None):
    context_part = ""
    if (previous_code):
        context_part = f"\nHere is the previous code context:\n{previous_code}\n"

    modified_prompt = (
        f"Generate a new manim Scene based on this request: {req.Prompt}. "
        f"Strictly name the Scene class as: {req.SceneName}. "
        f"Ensure the animation does not exceed {req.DurationSec} seconds. "
        f"Use {req.Background} as the background color. "
        f"End the animation with a {req.Transition} transition. "
        f"{context_part}"
    )

    # Get the model from context instead of passed provider
    generator_model = get_model("GENERATOR")
    print("generator model milgya hai")
    result = await Runner.run(
        code_generator_agent,
        modified_prompt,
        run_config=RunConfig(model=generator_model)  # Pass the actual model instance
    )
    print("############################################################################generator used: input_tokens: ", result.context_wrapper.usage.input_tokens, "outputtokens: ", result.context_wrapper.usage.output_tokens ," across: ", result.context_wrapper.usage.requests, " requests")
    return result.final_output

async def generate_all_scenes(scenes: List[Scene]):
    results = []
    previous_code = None

    for scene in scenes:  
        props = Scene(**scene.dict())
        output = await code_gen_function(props, previous_code)
        results.append(output)
        previous_code = output.code 

    return results