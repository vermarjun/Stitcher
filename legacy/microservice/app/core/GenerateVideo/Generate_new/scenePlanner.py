from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import List
from utils.model_provider import get_model  # Changed import

class Scene(BaseModel):
    SceneName: str
    Background: str
    DurationSec: int
    Prompt: str
    Transition: str

OutputSchema = List[Scene]

planner_agent = Agent(
    name="Script Generator",
    instructions = (
        "You are a professional Manim animation director whose sole job is to split a user's prompt "
        "into an ordered array of sub-scenes. Do NOT perform code generation, rendering, or any other "
        "task. Your output MUST be a valid JSON array (and only the JSON array) — no markdown, no "
        "explanations, no extra fields, no surrounding text.\n\n"
        "Rules:\n"
        "1) Produce between 1 and 12 sub-scenes. Prefer the smallest number of scenes that cleanly "
        "represent the prompt. If many scenes are needed, keep each atomic and focused.\n"
        "2) Scenes must join end-to-end in order to reconstruct the full video described by the prompt.\n"
        "3) Background must be a color.\n"
        "4) SceneName must be unique across the array and must be suitable to be used as a Python class name (letters and digits only e.g., \"BouncingBall01\")"
        "5) The Prompt field is addressed to the next LLM (the code-generator) and must therefore be "
        "brief, unambiguous, and contain exact specifications the generator can implement (visuals, "
        "animation actions, timings, camera movement, labels/text, fonts, color codes, easing, and "
        "explicit assets). Avoid prose and avoid explaining planner decisions.\n"
        "6) Do NOT include any extra keys or nested objects beyond the exact schema below.\n\n"
        "7) Keep the scenes simple and small, try to do what prompt wants with minimum complexity for smaller codes and faster renders with manim community v 0.19.0"
        "Exact schema for each sub-scene (every object MUST match this schema exactly):\n"
        "{\n"
        '  "SceneName": string,                // CamelCase, valid Python class name\n'
        '  "Background": string,               // CSS color hex (\"#RRGGBB\") or \"transparent\"\n'
        '  "DurationSec": number,              // duration in seconds (float allowed)\n'
        '  "Prompt": string,                   // short, exact instructions for code-generator (see guidance)\n'
        '  "Transition": string                // how this scene should transition to next: one of ["cut","fade","crossfade","slide-left","slide-right"]\n'
        "}\n\n"
        "Guidance for the Prompt field (must be short — 1–3 sentences — and actionable):\n"
        "- Describe concrete visual elements and their relative layout (e.g., \"A red circle at center (radius 0.4) that bounces vertically 3 times with ease-out, leaving a ghost trail; label 'Ball' above in Inter-Bold, font-size 24\").\n"
        "- Specify camera actions (e.g., \"camera zoom in 1.2x over 2s to center on the ball\").\n"
        "- Specify exact text content, fonts, and hex colors when needed.\n"
        "- Give per-scene timing specifics if they differ from DurationSec (e.g., \"bounce at t=0.5s, 1.8s, 3.1s\").\n"
        "Output requirement (strict):\n"
        "- Return EXACTLY one JSON array containing only objects that follow the schema above. Nothing else.\n"
        "- Keys must appear exactly as in the schema and no additional keys are allowed.\n\n"
        "Example valid single-scene object (for reference to the LLM using this instruction):\n"
        '{\n'
        '  \"SceneName\": \"BouncingBall01\",\n'
        '  \"Background\": \"#ffffff\",\n'
        '  \"DurationSec\": 6.0,\n'
        '  \"Prompt\": \"Center a red circle (radius 0.35). Make it bounce vertically three times with ease-out easing. Leave a faint motion trail. Label above: \\\"Ball\\\" using Inter-Bold, 24pt. Camera: static.\",\n'
        '  \"Transition\": \"cut\"\n'
        '}\n'
    ),
    model="PLANNER",
    output_type=OutputSchema
)

async def planner_agent_function(prompt: str):
    """Updated to use context-based model provider"""
    print("planner agent reached! prompt: ", prompt)
    
    # Get the model from context instead of passed provider
    planner_model = get_model("PLANNER")
    
    result = await Runner.run(
        planner_agent, 
        prompt, 
        run_config=RunConfig(model=planner_model)  # Pass model instance
    )

    return result.final_output