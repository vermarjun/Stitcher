from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import Optional
from config import MULTI_MODEL_PROVIDER

class DebuggerOutput(BaseModel):
    fixed_code: str

manim_debugger_agent = Agent(
    name="Manim Code Debugger",
    instructions=(
        "You are an expert Python developer and debugger with deep knowledge of manim-community v0.19.0. "
        "You have to make conservative edits to fix the error while preserving the original structure and intent of the code provided."
        "Your job is to take broken manim scene code and a renderer error message (traceback / logs) and produce "
        "a corrected version of the code that will render successfully under manim-community v0.19.0.\n\n"
        "Rules and expectations:\n"
        "1) ALWAYS output a single complete Python source file as the only response (no wrapper prose).\n"
        "2) Preserve the Scene class name exactly unless the error proves the class name is invalid; if you change it, explain why in the summary field.\n"
        "3) Make the smallest, safest edits possible to fix the error (e.g., fix syntax, add missing imports, correct attribute names, replace deprecated API calls with the recommended v0.19.0 alternatives, fix type issues causing runtime crashes).\n"
        "4) If you cannot be certain of the correct fix, add defensive guards and fallback behavior that keeps the animation simple but valid (for example, replace an expensive animation call with a simple ShowCreation or FadeIn).\n"
        "5) Do NOT invent external assets (images, fonts) that are not provided. If an asset is missing, replace usage with a reasonable placeholder (Text(\"MISSING_ASSET\") or Circle()).\n"
        "6) If the provided error message includes a Python traceback, parse it and target the most relevant frame(s)."
        "7) Ensure the final code uses only APIs compatible with manim-community v0.19.0; do not use deprecated methods from older manim versions.\n"
        "8) The agent's output must be validated (syntactically correct Python). Keep code concise and avoid adding long unrelated utilities.\n"
    ),
    model="DEBUGGER",
    output_type=DebuggerOutput,
)


async def debugger_agent_wrapper(original_code: str, error_msg: str, extra_context: Optional[str] = None):
    # print("trying to debug")
    # print("Original code: ", original_code)

    prompt = (
        "The user attempted to render the following manim Python file and it failed.\n\n"
        "--- BEGIN ORIGINAL CODE ---\n"
        f"{original_code}\n"
        "--- END ORIGINAL CODE ---\n\n"
        "The renderer returned this error / traceback:\n"
        f"{error_msg}\n\n"
        "Please produce a fixed, ready-to-render Python source file."
    )

    if extra_context:
        prompt += f"\nAdditional context: {extra_context}\n"

    # print("context prompt ready")

    result = await Runner.run(
        manim_debugger_agent,
        prompt,
        run_config=RunConfig(model_provider=MULTI_MODEL_PROVIDER)
    )

    # print("debugger result came: ", result.final_output)
    return result.final_output
