from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from typing import List
from app.utils.initialize_redis import get_redis_manager, fetch_api_key_with_wait
from openai import AsyncOpenAI

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
                5) Produce between 1 to 4 sub-scenes. Prefer the smallest number of scenes possible.
                NOTE: A SINGLE SCENE AT ANY POINT DOES NOT HAVE ANY CONTEXT OF SCENES BEFORE OR AFTER IT, NEVER EVER
                MENTION PREVIOUS SCENES. EACH SCENE YOU PLAN MUST AT ALL COSTS ALWAYS AND ALWAYS BE SINGLE INDEPENDENT SCENE WITH
                ZERO DEPENDANCE ON ANY SCENE OTHER THAN IT SELF. A SCENE AT ANY POINT SHOULD NOT TAKE ANY REFERENCE FROM ANY OTHER
                SCENE OTHER THAN IT SELF. EACH SCENE MUST AT ALL COSTS BE INDEPENDENT AND SELF SUFFICIENT. 
"""),
    output_type=OutputSchema
)


async def planner_agent_function(prompt: str):
    print("planner model called!")

    # Get least used API key from Redis
    redis_manager = get_redis_manager()
    
    api_config = await fetch_api_key_with_wait(
        redis_manager,
        retry_delay=2,       # waits 2 seconds each time
        max_wait=60         # max wait = 1 minute
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
        # Return the API key to heap with updated token count
        new_total_tokens = current_tokens + tokens_used_in_request
        redis_manager.update_token_usage(email, new_total_tokens)
        print(f"Returned API key for {email} to heap. New token usage: {new_total_tokens}")