"""
Example Prompt Cache

This module contains pre-generated results for example prompts shown in the frontend QuickPrompts.
Instead of processing these prompts through the full pipeline, we return cached results.

TODO: Replace all PLACEHOLDER values with your actual pre-generated data:
- Planner output (scene descriptions)
- Generated code for each scene  
- Cloudinary URLs and metadata
- Final summary text
"""

from typing import Dict, List, Optional, Any

# Cache structure for each example
EXAMPLE_CACHE: Dict[str, Dict[str, Any]] = {
    "flower_of_life": {
        "prompts": [
            "Create a flower of life pattern by drawing overlapping circles that form the sacred geometry symbol",
        ],
        
        # Planner output - matches SceneObject structure
        "planner_output": [
            {
                "SceneName": "scene_1",
                "Prompt": "PLACEHOLDER - Replace with actual scene description",
                "RequiredMObjects": ["Circle", "VGroup"],  # Example - replace with actual
                "RequiredAnimations": ["Create", "FadeIn"]  # Example - replace with actual
            },
            # Add more scenes if needed
        ],
        
        # Generator output - code for each scene
        "scenes_with_code": [
            {
                "sceneName": "scene_1",
                "code": """# PLACEHOLDER - Replace with actual generated Manim code
from manim import *

class scene_1(Scene):
    def construct(self):
        # Your pre-generated code here
        pass
""",
                "description": "PLACEHOLDER - Replace with scene description",
                "RequiredMObjects": ["Circle", "VGroup"],
                "RequiredAnimations": ["Create", "FadeIn"]
            },
            # Add more scenes matching planner_output
        ],
        
        # Cloudinary metadata for each rendered scene
        "cloudinary_metadata": [
            {
                "sceneName": "scene_1",
                "videoUrl": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1768943612/68eefd7b0465a2d1f8576947_SineToCosineTransform_1768943609.mp4",
                "thumbnailUrl": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768422994/pinkroom/thumbnails/e17dlezemgykn7fv0zfu.jpg",
                "width": 1920,
                "height": 1080,
                "duration": 5.0,  # in seconds
                "format": "mp4",
                "bytes": 1234567,  # file size
                "public_id": "PLACEHOLDER - cloudinary_public_id",
                # Add any other Cloudinary metadata you have
            },
            # Add metadata for each scene
        ],
        
        # Final summary response
        "summary": "PLACEHOLDER - Replace with your final LLM response summary for this example"
    },
    
    "lissajous_curve": {
        "prompts": [
            "Create a lissajous curve by plotting parametric equations with two different frequency sine waves",
        ],
        
        "planner_output": [
            {
                "SceneName": "scene_1",
                "Prompt": "PLACEHOLDER - Replace with actual scene description",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "scene_1",
                "code": """# PLACEHOLDER - Replace with actual generated Manim code
from manim import *

class scene_1(Scene):
    def construct(self):
        # Your pre-generated code here
        pass
""",
                "description": "PLACEHOLDER - Replace with scene description",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "cloudinary_metadata": [
            {
                "sceneName": "scene_1",
                "videoUrl": "PLACEHOLDER - https://res.cloudinary.com/...",
                "thumbnailUrl": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768422994/pinkroom/thumbnails/e17dlezemgykn7fv0zfu.jpg",
                "width": 1920,
                "height": 1080,
                "duration": 5.0,
                "format": "mp4",
                "bytes": 1234567,
                "public_id": "PLACEHOLDER - cloudinary_public_id",
            },
        ],
        
        "summary": "PLACEHOLDER - Replace with your final LLM response summary"
    },
    
    "golden_mandala": {
        "prompts": [
            "Create a mandala pattern that draws itself from center outward with symmetrical petals and geometric patterns in gold and purple",
        ],
        
        "planner_output": [
            {
                "SceneName": "scene_1",
                "Prompt": "PLACEHOLDER - Replace with actual scene description",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "scene_1",
                "code": """# PLACEHOLDER - Replace with actual generated Manim code
from manim import *

class scene_1(Scene):
    def construct(self):
        # Your pre-generated code here
        pass
""",
                "description": "PLACEHOLDER - Replace with scene description",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "cloudinary_metadata": [
            {
                "sceneName": "scene_1",
                "videoUrl": "PLACEHOLDER - https://res.cloudinary.com/...",
                "thumbnailUrl": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768422994/pinkroom/thumbnails/e17dlezemgykn7fv0zfu.jpg",
                "width": 1920,
                "height": 1080,
                "duration": 5.0,
                "format": "mp4",
                "bytes": 1234567,
                "public_id": "PLACEHOLDER - cloudinary_public_id",
            },
        ],
        
        "summary": "PLACEHOLDER - Replace with your final LLM response summary"
    }
}


def find_cached_example(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Check if the given prompt matches any cached example.
    
    Args:
        prompt: The user's prompt string
        
    Returns:
        The cached example data if matched, None otherwise
    """
    prompt_lower = prompt.strip().lower()
    
    for example_key, example_data in EXAMPLE_CACHE.items():
        for cached_prompt in example_data["prompts"]:
            if cached_prompt.lower() == prompt_lower:
                print(f"[ExampleCache] ✓ Cache hit for example: {example_key}")
                return example_data
    
    print(f"[ExampleCache] ✗ No cache hit, proceeding with normal flow")
    return None


def validate_cache_data() -> List[str]:
    """
    Validate that cache data has been filled in (no PLACEHOLDER values).
    
    Returns:
        List of validation errors (empty if all valid)
    """
    errors = []
    
    for example_key, example_data in EXAMPLE_CACHE.items():
        # Check if any string values contain PLACEHOLDER
        def check_placeholders(obj, path=""):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    check_placeholders(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_placeholders(item, f"{path}[{i}]")
            elif isinstance(obj, str) and "PLACEHOLDER" in obj:
                errors.append(f"{example_key}{path}: Contains PLACEHOLDER")
        
        check_placeholders(example_data, "")
    
    return errors
