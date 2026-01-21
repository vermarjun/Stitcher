from typing import List, Dict, Any
from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.utils.initialize_redis import get_summarizer_heap_manager, fetch_api_key_with_queue

class CompletionSummary(BaseModel):
    summary: str

RESPONSE_GENERATOR_SYSTEM_PROMPT = """You are a completion summary specialist for video generation. Your task is to create a final closing message that summarizes what has been accomplished.

Given information about the video generation process, create a summary that:
1. Briefly mentions the original user request
2. Summarizes the overall process and what was created
3. Highlights successful outcomes
4. Mentions any issues if they occurred (be honest but positive)
5. Ends with a helpful closing statement
6. You have to summarize that what scenes were created, how many were successful and what scenes failed. Explain what was the error and why the scenes failed. 

Keep everything concise as ending remarks.

CRITICAL REQUIREMENTS:
- Keep the ENTIRE summary under 50 words
- Use first person voice ("I have...", "I created...", "I generated...")
- Be conversational and friendly, not robotic. Use a friendly tone
- Focus on accomplishments and the final result
- If there were failures, acknowledge them but maintain a positive, solution-oriented tone
- Make the user feel their request was handled well"""

response_generator_agent = Agent(
    name="Completion Summary Generator",
    instructions=RESPONSE_GENERATOR_SYSTEM_PROMPT,
    output_type=CompletionSummary
)

async def response_generator(
    scenes: List[Dict[str, Any]],
    original_prompt: str
) -> str:
    
    # Analyze the results
    total_scenes = len(scenes)
    successful_scenes = sum(1 for s in scenes if s.get("metadata") is not None and s.get("error") is None)
    failed_scenes = total_scenes - successful_scenes
    try:
        # Build context for the LLM
        scenes_summary = []
        for i, scene in enumerate(scenes, 1):
            status = "Successfully rendered" if scene.get("metadata") else scene.get("error")
            scene_name = scene.get("sceneName", f"Scene {i}")
            scenes_summary.append(f"- {scene_name}: {status}")
        
        scenes_text = "\n".join(scenes_summary)
        
        user_prompt = f"""The user originally requested: "{original_prompt}"

Video generation process completed:
- Total scenes planned: {total_scenes}
- Successfully rendered: {successful_scenes}
- Had issues: {failed_scenes}

Scene breakdown:
{scenes_text}
"""
        
        summarizer_heap_manager = get_summarizer_heap_manager()
        api_config = await fetch_api_key_with_queue(
            summarizer_heap_manager,
            timeout=300  # 5 minutes max wait
        )

        email = api_config["email"]
        api_key = api_config["api_key"]
        base_url = api_config["base_url"]
        model_name = api_config["model"]
        current_tokens = api_config.get("tokens_used", 0)

        print(f"[Response Generator] Using {email} with {current_tokens} tokens")
        
        tokens_used_in_request = 0
        try:
            # Create OpenAI client
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )

            # Inject dynamic model
            response_generator_agent.model = OpenAIChatCompletionsModel(
                model=model_name,
                openai_client=client
            )
            result = await Runner.run(
                response_generator_agent,
                user_prompt
            )
            summary = result.final_output.summary

            if result.context_wrapper.usage:
                tokens_used_in_request = result.context_wrapper.usage.total_tokens

            print(f"✓ Response generator completed: {len(summary.split())} words")

            return summary
        
        except Exception as e:
            print(f"Error in response generator LLM call, returning API key for {email}")
            raise e

        finally:
            # Return the API key to summarizer heap with updated token count
            new_total_tokens = current_tokens + tokens_used_in_request
            summarizer_heap_manager.update_token_usage(email, new_total_tokens)
            print(f"Returned API key for {email} to summarizer heap. New token usage: {new_total_tokens}")    
        
    except Exception as e:
        print(f"Error in response generator: {e}")
        # Fallback response
        if successful_scenes == total_scenes:
            return f"I have completed what you asked for! I created all {total_scenes} scenes for your video based on your prompt: '{original_prompt}'. Your video is ready and all scenes rendered successfully."
        elif successful_scenes > 0:
            return f"I have processed your request for '{original_prompt}'. I successfully generated {successful_scenes} out of {total_scenes} scenes. Some scenes encountered issues, but your video has been partially created and is available."
        else:
            return f"I attempted to create the video you requested for '{original_prompt}', but encountered issues with all {total_scenes} scenes during generation. Please try simplifying your request or contact support for assistance."