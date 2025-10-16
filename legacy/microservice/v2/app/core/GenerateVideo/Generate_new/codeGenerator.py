from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import List
from .scenePlanner import Scene
from utils.model_provider import get_model  

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
    model="CODER",
    output_type=OutputSchema
)

async def code_gen_function(Scene: Scene):
    prompt = (
        f"You have to write the simplest possible code which keeps things minimal, does not break and does what is asked with minimum possible lines of code. Do not include comments in the output code."
        f"Generate python code for manim-community version v0.19.0 to implement this: {Scene.Prompt}. "
        f"Name the Scene class as: {Scene.SceneName}. "
        f"Use Black as the background color. "
        f"End the scene with a Fade transition. Ex: self.wait(2)\n self.play(FadeOut(*self.mobjects)). "
    )

    generator_model = get_model("GENERATOR")

    result = await Runner.run(
        code_generator_agent,
        prompt,
        run_config=RunConfig(model=generator_model)
    )
    
    return result.final_output.code

async def generate_all_scenes(Scenes: List[Scene]):
    results = []

    for Scene in Scenes:
        code = await code_gen_function(Scene)
        results.append({
            "code" : code,
            "sceneName" : Scene.SceneName
        })

    return results