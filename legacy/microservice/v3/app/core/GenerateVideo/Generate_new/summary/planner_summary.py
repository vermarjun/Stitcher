from typing import List, Dict, Union
from agents import Agent, Runner, OpenAIChatCompletionsModel
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.utils.initialize_redis import get_redis_manager, fetch_api_key_with_wait
from app.core.GenerateVideo.Generate_new.chat_updater import ChatUpdater
from app.utils.event_publisher import publish_event

class VideoSummary(BaseModel):
    summary: str

class SceneObject(BaseModel):
    SceneName: str
    Prompt: str
    RequiredMObjects: List[str] = []
    RequiredAnimations: List[str] = []

SUMMARIZER_SYSTEM_PROMPT = """
You are plan summarizer agent. Your job is to summarize the plans made by other agents. You are provided with an 
array of Scenes where each Scene has a SceneName and it's description. You have to summarize entire thing to a human.
You have to explain in short: 
1. How many scenes are planned.
2. Scene Name
3. What each scene has to explain
4. What the user can expect when these scenes are rendered independently and merged as a single video as output

You have to just brief the user about intensions and plans of the planner agent, whose plan is given to you and you have 
to give a summary of that plan as an output;

CRITICAL REQUIREMENTS:
- Use a natural and engaging language which is conforting attracting and soothing to read, 
- Keep your summary under 30 words at max. 
- Focus on the overall narrative and visual journey
- Use first person voice ("I have...", "I created...", "I generated...")
- Be conversational and friendly, not robotic. Use a friendly tone
"""

summarizer_agent = Agent(
    name="Video Summary Generator",
    instructions=SUMMARIZER_SYSTEM_PROMPT,
    output_type=VideoSummary
)

def normalize_scene(scene: Union[Dict, object]) -> SceneObject:
    """Convert Scene object or dict to a standardized SceneObject"""
    if isinstance(scene, dict):
        return SceneObject(
            SceneName=scene.get('SceneName', scene.get('sceneName', 'Unknown')),
            Prompt=scene.get('Prompt', scene.get('prompt', '')),
            RequiredMObjects=scene.get('RequiredMObjects', []),
            RequiredAnimations=scene.get('RequiredAnimations', [])
        )
    # Handle Pydantic model or object with attributes
    return SceneObject(
        SceneName=getattr(scene, 'SceneName', getattr(scene, 'sceneName', 'Unknown')),
        Prompt=getattr(scene, 'Prompt', getattr(scene, 'prompt', '')),
        RequiredMObjects=getattr(scene, 'RequiredMObjects', []),
        RequiredAnimations=getattr(scene, 'RequiredAnimations', [])
    )

async def summarizer_agent_function_streaming(
    planner_output: List[Union[Dict, object]], 
    chat_id: str
) -> str:
    """
    Streaming version of summarizer that publishes chunks in real-time.
    Returns the complete summary text.
    """
    try:
        # Get least used API key from Redis
        redis_manager = get_redis_manager()
        api_config = await fetch_api_key_with_wait(
            redis_manager,
            retry_delay=2,
            max_wait=60
        )

        email = api_config["email"]
        api_key = api_config["api_key"]
        base_url = api_config["base_url"]
        model_name = api_config["model"]
        current_tokens = api_config.get("tokens_used", 0)

        print(f"[Summarizer Streaming] Using API key for: {email} with {current_tokens} tokens used")

        # Normalize all scenes to SceneObject format
        scenes = [normalize_scene(scene) for scene in planner_output]
        
        # Format the planner output for the LLM
        scenes_text = "\n".join([
            f"Scene {i+1} ({scene.SceneName}): {scene.Prompt}"
            for i, scene in enumerate(scenes)
        ])

        try:
            # Create OpenAI client directly for streaming (agents library may not support streaming)
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )
            
            # Use OpenAI's streaming API directly instead of agents library
            messages = [
                {"role": "system", "content": SUMMARIZER_SYSTEM_PROMPT},
                {"role": "user", "content": scenes_text}
            ]
            
            print(f"[Summarizer Streaming] Starting stream for chat {chat_id}")
            
            accumulated_text = ""
            chunk_buffer = ""
            word_count = 0
            
            # Stream the response
            stream = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=True,
                temperature=0.7
            )
            
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        content = delta.content
                        accumulated_text += content
                        chunk_buffer += content
                        
                        # Publish chunks word-by-word or when we have a few characters
                        # This balances real-time feel with network efficiency
                        if ' ' in chunk_buffer or len(chunk_buffer) >= 10:
                            words = chunk_buffer.split(' ')
                            for i, word in enumerate(words[:-1]):
                                if word.strip():
                                    publish_event(chat_id, "SUMMARY_CHUNK", {
                                        "chunk": word + " ",
                                        "index": word_count
                                    })
                                    word_count += 1
                            chunk_buffer = words[-1] if words else ""
            
            # Publish any remaining text
            if chunk_buffer.strip():
                publish_event(chat_id, "SUMMARY_CHUNK", {
                    "chunk": chunk_buffer,
                    "index": word_count
                })
            
            summary = accumulated_text.strip()
            
            # Estimate token usage (rough approximation: 1 token ≈ 4 characters)
            tokens_used_in_request = len(scenes_text + summary) // 4
            
            # Update token usage
            new_total_tokens = current_tokens + tokens_used_in_request
            redis_manager.update_token_usage(email, new_total_tokens)
            
            print(f"[Summarizer Streaming] Completed: {len(summary.split())} words streamed")
            print(f"[Summarizer Streaming] Updated token usage for {email}: {new_total_tokens}")
            
            return summary
        
        except Exception as e:
            print(f"[Summarizer Streaming] Error occurred, returned API key for {email} to heap")
            raise e
        finally:
            # Return the API key to heap even if there's an error
            redis_manager.return_api_key(email, current_tokens)
        
    except Exception as e:
        print(f"[Summarizer Streaming] Error in streaming: {e}")
        # Publish error and fallback to basic summary
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes[:3]]
        fallback_summary = f"Your video will contain {len(planner_output)} scenes covering: {', '.join(scene_names)}{'...' if len(planner_output) > 3 else ''}."
        
        # Publish the fallback as a single chunk
        publish_event(chat_id, "SUMMARY_CHUNK", {
            "chunk": fallback_summary,
            "index": 0
        })
        
        return fallback_summary

async def summarizer_agent_function(planner_output: List[Union[Dict, object]]) -> str:
    """
    Non-streaming version (fallback compatibility).
    """
    try:
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

        # Normalize all scenes to SceneObject format
        scenes = [normalize_scene(scene) for scene in planner_output]
        
        # Format the planner output for the LLM
        scenes_text = "\n".join([
            f"Scene {i+1} ({scene.SceneName}): {scene.Prompt}"
            for i, scene in enumerate(scenes)
        ])

        print("This is what is given as input to planner_summary: ",scenes_text)
        
        tokens_used_in_request = 0
        try:
            # Create OpenAI client with the retrieved config
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )
            
            summarizer_agent.model = OpenAIChatCompletionsModel(model=model_name, openai_client=client)

            # Run the planner agent with the custom model
            result = await Runner.run(
                summarizer_agent, 
                scenes_text
            )

            summary = result.final_output.summary
            
            if result.context_wrapper.usage:
                tokens_used_in_request = result.context_wrapper.usage.total_tokens
            
            # print(f"✓ Summarizer agent completed: {len(summary.split())} words")
            return summary
        
        except Exception as e:
            print(f"Error occurred, returned API key for {email} to heap")
            raise e
        finally:
            # Return the API key to heap with updated token count
            new_total_tokens = current_tokens + tokens_used_in_request
            redis_manager.update_token_usage(email, new_total_tokens)
            print(f"Returned API key for {email} to heap. New token usage: {new_total_tokens}")
        
    except Exception as e:
        print(f"Error in summarizer agent: {e}")
        # Fallback to a basic summary
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes[:3]]
        return f"Your video will contain {len(planner_output)} scenes covering: {', '.join(scene_names)}{'...' if len(planner_output) > 3 else ''}."

async def summarizer_agent_wrapper(
    chat_id: str,
    planner_output: List[Union[Dict, object]]
):
    try:
        print(f"[Summarizer Wrapper] Starting summarizer for chat {chat_id}...")
        
        # Use non-streaming version - frontend will handle animation
        summary = await summarizer_agent_function(planner_output)
        
        # Normalize scenes to SceneObject format for MongoDB storage
        normalized_scenes = [normalize_scene(scene) for scene in planner_output]
        
        # Update MongoDB with planner output and scenes
        await ChatUpdater.update_planner_output(
            chat_id=chat_id,
            planner_summary=summary,
            scenes=normalized_scenes
        )
        
        # Publish completion event with full summary
        # Frontend will animate this word-by-word
        publish_event(chat_id, "SUMMARY_COMPLETE", {
            "summary": summary,
            "sceneCount": len(normalized_scenes)
        })
        
        print(f"[Summarizer Wrapper] ✓ Completed for chat {chat_id}")
        
    except Exception as e:
        print(f"[Summarizer Wrapper] Error in wrapper: {e}")

        # Update with a basic summary if agent fails
        scenes = [normalize_scene(scene) for scene in planner_output]
        scene_names = [s.SceneName for s in scenes]
        fallback_summary = f"Video generation plan created with {len(planner_output)} scenes: {', '.join(scene_names)}."
        
        await ChatUpdater.update_planner_output(
            chat_id=chat_id,
            planner_summary=fallback_summary,
            scenes=scenes
        )
        
        # Publish fallback completion event
        publish_event(chat_id, "SUMMARY_COMPLETE", {
            "summary": fallback_summary,
            "sceneCount": len(scenes),
            "error": str(e)
        })