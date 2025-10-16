from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from utils.model_provider import get_model  

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
    
    prompt = (
        f"Fix this broken Manim code:\n\n"
        "--- BEGIN ORIGINAL CODE ---\n"
        f"{original_code}\n"
        "--- END ORIGINAL CODE ---\n\n"
        "The renderer returned this error / traceback:\n"
        f"{error_msg}\n\n"
        "Please produce a fixed, ready-to-render Python source file."
    )

    debugger_model = get_model("DEBUGGER")
    
    result = await Runner.run(
        manim_debugger_agent,
        prompt,
        run_config=RunConfig(model=debugger_model) 
    )
    print("debugger used: input_tokens used: ", result.context_wrapper.usage.input_tokens, " outputtokens_used: " , result.context_wrapper.usage.output_tokens," across: ", result.context_wrapper.usage.requests, " requests")
    return result.final_output.fixed_code