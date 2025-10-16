from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from utils.model_provider import get_model  # Changed import

class ModifierOutput(BaseModel):
    code: str

code_modifier_agent = Agent(
    name="Manim Code Modifier",
    instructions=(
        "You are an expert Python developer specializing in manim-community v0.19.0. "
        "Your task is to refactor, modify, or enhance EXISTING code based on user instructions. "
        "Always ensure the modified code remains valid and fully compatible with manim-community v0.19.0. "
        "Do not introduce deprecated APIs or invalid syntax. "
        "Preserve the overall structure of the existing code unless changes are explicitly requested. "
        "When modifying, ensure animations remain smooth, clear, and educational in style (like 3Blue1Brown). "
        "Do not add unnecessary complexity — only make the requested modifications. "
        "If adding text or new elements, avoid collisions by placing them carefully. "
        "The ONLY expected output is the FULL modified Python code."
    ),
    model="GENERATOR",  # Changed from "CODER" to "GENERATOR" to match your config
    output_type=ModifierOutput
)

async def code_modify_function(original_code: str, modification_prompt: str):
    """
    Takes the original code and a modification request,
    returns the modified code.
    Updated to use context-based model provider
    """
    modified_prompt = (
        f"Here is the original code:\n{original_code}\n\n"
        f"Modify/refactor this code according to the following request:\n{modification_prompt}\n\n"
        f"Output ONLY the full modified Python code."
    )

    # Get the model from context instead of passed provider
    generator_model = get_model("GENERATOR")
    
    result = await Runner.run(
        code_modifier_agent,
        modified_prompt,
        run_config=RunConfig(model=generator_model)  # Pass model instance
    )

    return result.final_output.code  # Added .code to match the output structure