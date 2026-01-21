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
        "planner_output": [
            {
                "SceneName": "scene_1",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "VGroup"],  # Example - replace with actual
                "RequiredAnimations": ["Create", "FadeIn"]  # Example - replace with actual
            },
        ],
        "scenes_with_code": [
            {
                "sceneName": "scene_1",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1768958312/FlowerOfLife_xt02gy.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768958422/Screenshot_2026-01-21_at_6.50.13_AM_wirgix.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1567890,
                "public_id": "FlowerOfLife_xt02gy",
            },
        ],
        
        # Final summary response
        "planner_summary": "I've created 1 beautiful scene, revealing sacred geometry. From a central circle, you'll see the Seed, then the wondrous Flower of Life bloom, merging into one elegant journey.",
        "final_summary": "I successfully created your 'flower of life' video! All three scenes, CentralCircle, SeedOfLife, and FlowerOfLife, rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    
    "lissajous_curve": {
        "prompts": [
            "Create a lissajous curve by plotting parametric equations with two different frequency sine waves",
        ],
        
        "planner_output": [
            {
                "SceneName": "Lissajous curve",
                "Prompt": "",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "LissajousCurveScene",
                "code": """""",
                "description": "PLACEHOLDER - Replace with scene description",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1768958327/LissajousCurves_r9lmr3.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768959322/Screenshot_2026-01-21_at_7.05.13_AM_h6tuei.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "LissajousCurves_r9lmr3",
            },
        ],
        
        "planner_summary": "I've crafted one scene, LissajousCurveScene, showcasing a beautiful Lissajous curve, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'lissajous curve' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    
    "golden_mandala": {
        "prompts": [
            "Create a mandala pattern that draws itself from center outward with symmetrical petals and geometric patterns in gold and purple",
        ],
        
        "planner_output": [
            {
                "SceneName": "Golden Mandala",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "GoldenMandalaScene",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1768958348/MandalaPattern_vfemzi.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1768958958/Screenshot_2026-01-21_at_6.59.05_AM_sqv0pb.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "MandalaPattern_vfemzi",
            },
        ],
        
        "planner_summary": "I've crafted one scene, GoldenMandalaScene, showcasing a Golden Mandala Pattern, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Golden Mandala' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
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
