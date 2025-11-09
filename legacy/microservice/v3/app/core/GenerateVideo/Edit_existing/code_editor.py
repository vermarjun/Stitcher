from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from typing import List, Dict, Any
from app.utils.initialize_redis import get_redis_manager, fetch_api_key_with_wait
from openai import AsyncOpenAI

class OutputSchema(BaseModel):
    code: str
    scene_description: str

code_editor_agent = Agent(
    name="Manim Code Editor",
    instructions=("""
You are an expert Python developer specializing in manim-community v0.19.0.
Your job is to edit existing Manim code based on user requests.

WORKFLOW:
1. You will receive one or more existing Manim scenes with their code
2. User will describe changes they want
3. You must integrate/merge all provided scenes and apply the requested edits
4. Output a single unified scene called "final_edit"

REQUIREMENTS:
1. Scene MUST be named: final_edit
2. If multiple scenes provided, intelligently merge them
3. Apply user's requested changes to the merged code
4. Keep code simple, minimal, and efficient
5. Use only manim-community v0.19.0 compatible APIs
6. NO comments in the code
7. Output must include working code and detailed scene description

CODING GUIDELINES:
- Prefer simplicity over complexity
- Use minimal lines of code
- Ensure fast render times
- Avoid deprecated manim features
- If merging scenes, maintain logical animation flow
- Handle edge cases gracefully

OUTPUT FORMAT:
- code: Valid Python manim v0.19.0 code with class final_edit
- scene_description: Detailed technical description of what the animation does
"""),
    output_type=OutputSchema
)

async def coder_agent_wrapper(assets: List[Dict[str, Any]], prompt: str) -> List[Dict[str, str]]:
    try:
        if not assets:
            raise ValueError("No assets provided for editing")
        
        context_parts = [
            f"User's edit request: {prompt}\n",
            "\n=== EXISTING SCENES TO EDIT ===\n"
        ]
        
        for idx, asset in enumerate(assets, 1):
            scene_name = asset.get("scene_name", f"Scene_{idx}")
            scene_desc = asset.get("scene_description", "No description")
            code = asset.get("code", "")
            
            if not code:
                print(f"Warning: Asset {scene_name} has no code")
                continue
            
            context_parts.append(
                f"\n--- Scene {idx}: {scene_name} ---\n"
                f"Description: {scene_desc}\n"
                f"Code:\n{code}\n"
            )
        
        context_parts.append(
            "\n=== YOUR TASK ===\n"
            "Merge the above scene(s) and apply the user's requested changes.\n"
            "Output a single scene named 'final_edit' with the modifications."
        )
        
        final_prompt = "".join(context_parts)
        
        print(f"\n📝 Sending {len(assets)} scene(s) to code editor...")
        print(f"Prompt length: {len(final_prompt)} characters")
        
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

        try:
            # Create OpenAI client with the retrieved config
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url
            )
            
            code_editor_agent.model = OpenAIChatCompletionsModel(model=model_name, openai_client=client)

            # Run the planner agent with the custom model
            result = await Runner.run(
                code_editor_agent, 
                final_prompt
            )
            
            tokens_used_in_request = 0
            if result.context_wrapper.usage:
                tokens_used_in_request = result.context_wrapper.usage.total_tokens
            
            # Update token usage
            new_total_tokens = current_tokens + tokens_used_in_request
            redis_manager.update_token_usage(email, new_total_tokens)
            
            print(f"Updated token usage for {email}: {new_total_tokens}")    

            return [{
                "code": result.final_output.code,
                "sceneName": "final_edit",
                "sceneDescription": result.final_output.scene_description
            }]
            
        except Exception as e:
            print(f"Error occurred, returned API key for {email} to heap")
            raise e
        
        finally:
            # Return the API key to heap even if there's an error
            redis_manager.return_api_key(email, current_tokens)
    except Exception as e:
        print(f"✗ Code editor error: {str(e)}")
        raise