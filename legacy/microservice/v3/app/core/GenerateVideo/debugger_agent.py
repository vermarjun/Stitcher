from agents import Agent, Runner, RunConfig, OpenAIChatCompletionsModel
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.utils.initialize_redis import get_coder_heap_manager, fetch_api_key_with_queue

class DebuggerOutput(BaseModel):
    fixed_code: str

manim_debugger_agent = Agent(
    name="Manim Code Debugger",
    instructions=(
        "You are an expert Python developer and debugger with deep knowledge of manim-community v0.19.0. "
        "Your job is to take broken manim scene code and a renderer error message (traceback / logs) and produce "
        "a corrected version of the code that will render successfully under manim-community v0.19.0.\n\n"
        "End goal is to get the animation to render somehow such that it does not break again. "
        "NOTE:"
        "1) If you cannot be certain of the correct fix, add defensive guards and fallback behavior that keeps the animation simple but valid. Do anything to bypass the part that is causing the error to get it working.\n"
        "2) Ensure the final code uses only APIs compatible with manim-community v0.19.0; do not use deprecated methods from older manim versions.\n"
        "3) The agent's output must be validated (syntactically correct Python). Keep the code concise.\n"
    ),
    output_type=DebuggerOutput,
)

async def debugger_agent_wrapper(original_code: str, error_msg: str):
    print("Debugger is called!")
    print(f"This is the code that needs to be fixed: {original_code}, this is the error msg: {error_msg}")
    
    prompt = (
        f"Fix this broken Manim code:\n\n"
        "--- BEGIN ORIGINAL CODE ---\n"
        f"{original_code}\n"
        "--- END ORIGINAL CODE ---\n\n"
        "The renderer returned this error / traceback:\n"
        f"{error_msg}\n\n"
        "Please produce a fixed, ready-to-render Python source file."
    )

    try:
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
            
            manim_debugger_agent.model = OpenAIChatCompletionsModel(model=model_name, openai_client=client)

            # Run the planner agent with the custom model
            result = await Runner.run(
                manim_debugger_agent, 
                prompt
            )
            
            if result.context_wrapper.usage:
                tokens_used_in_request = result.context_wrapper.usage.total_tokens
            
            return result.final_output.fixed_code
        
        except Exception as e:
            print(f"Error occurred, returned API key for {email} to heap")
            raise e
        finally:
            # Return the API key to coder heap with updated token count
            new_total_tokens = current_tokens + tokens_used_in_request
            coder_heap_manager.update_token_usage(email, new_total_tokens)
            print(f"Returned API key for {email} to coder heap. New token usage: {new_total_tokens}")
        
    except Exception as e:
        print(f"Error in summarizer agent: {e}")
        return