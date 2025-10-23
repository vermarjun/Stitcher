from agents import Agent, Runner, RunConfig
from pydantic import BaseModel
from typing import List, Dict, Any
from utils.model_provider import get_model

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
    model="CODER",
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
        
        editor_model = get_model("GENERATOR")
        
        result = await Runner.run(
            code_editor_agent,
            final_prompt,
            run_config=RunConfig(model=editor_model)
        )
        
        print(f"✓ Code editor completed")
        print(f"Input tokens: {result.context_wrapper.usage.input_tokens}")
        print(f"Output tokens: {result.context_wrapper.usage.output_tokens}")
        
        return [{
            "code": result.final_output.code,
            "sceneName": "final_edit",
            "sceneDescription": result.final_output.scene_description
        }]
        
    except Exception as e:
        print(f"✗ Code editor error: {str(e)}")
        raise