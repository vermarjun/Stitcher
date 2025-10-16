from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import List
from utils.model_provider import get_model 

class Scene(BaseModel):
    SceneName: str
    Prompt: str

OutputSchema = List[Scene]

planner_agent = Agent(
    name="Script Generator",
    instructions = ("""
                Your job is to break the user prompt into scenes where each scene when rendered independently and combined again represents 
                the original prompt. Each scene you generate should have a SceneName and a prompt which clearly describes the purpose of
                that scene. You would generate an array of such Scenes and Code_generator_agents would generate python Manim v0.19.0 code
                for each scene in this array parallely without the context of entire prompt or other scenes.  
                1) In each scene's prompt describe clearly and unambigously what is to be displayed on the screen. The code generator agent 
                    will generate python Manim code for this scene based on this prompt.
                2) Always Always Always keep an opening scene which must be the simplest scene possible. Never keep the starting scene empty.
                3) Keep all the scenes as simple as possible, don't take complex examples, keep animations minimal. 
                4) The end goal of each scene is to achieve smallest possible code which could be rendered without any error even by the dumbest LLM models.
                5) Produce between 1 to 6 sub-scenes. Prefer the smallest number of scenes possible
                NOTE: A SINGLE SCENE AT ANY POINT DOES NOT HAVE ANY CONTEXT OF SCENES BEFORE OR AFTER IT, NEVER EVER
                MENTION PREVIOUS SCENES. EACH SCENE YOU PLAN MUST AT ALL COSTS ALWAYS AND ALWAYS BE SINGLE INDEPENDENT SCENE WITH
                ZERO DEPENDANCE ON ANY SCENE OTHER THAN IT SELF. A SCENE AT ANY POINT SHOULD NOT TAKE ANY REFERENCE FROM ANY OTHER
                SCENE OTHER THAN IT SELF. EACH SCENE MUST AT ALL COSTS BE INDEPENDENT AND SELF SUFFICIENT. 
"""),
    model="PLANNER",
    output_type=OutputSchema
)


async def planner_agent_function(prompt: str):
    print("planner model called!")

    # get the model
    planner_model = get_model("PLANNER")

    result = await Runner.run(
        planner_agent, 
        prompt, 
        run_config=RunConfig(model=planner_model) 
    )
    return result.final_output