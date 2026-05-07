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
    "Indian_gdp": {
        "prompts": [
            "Animate indian gdp growth between year 2020 to 2025, use modern minimal colors.",
        ],
        "planner_output": [
            {
                "SceneName": "GDP Growth 5years",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "VGroup"],  # Example - replace with actual
                "RequiredAnimations": ["Create", "FadeIn"]  # Example - replace with actual
            },
        ],
        "scenes_with_code": [
            {
                "sceneName": "GDP Growth 5years",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1769164126/IndiaGDP_a8oexw.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769171620/Screenshot_2026-01-23_at_6.03.31_PM_e0j7ja.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1567890,
                "public_id": "IndiaGDP_a8oexw",
            },
        ],
        
        # Final summary response
        "planner_summary": "I've created 1 beautiful scene, depicting India's gdp growth between year 2020 and 2025. I have used minimal colors as requested.",
        "final_summary": "I successfully created your Animation! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    
    "lissajous_curve": {
        "prompts": [
            "Create a lissajous curve by plotting parametric equations with two different frequency sine waves",
        ],
        
        "planner_output": [
            {
                "SceneName": "LissajousCurveScene",
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
    "boolean_operations": {
        "prompts": [
            "Create a clean, visually striking Manim animation that demonstrates Boolean set operations using overlapping 2D shapes.",
        ],
        
        "planner_output": [
            {
                "SceneName": "BooleanOperations",
                "Prompt": "",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "BooleanOperations",
                "code": """""",
                "description": "PLACEHOLDER - Replace with scene description",
                "RequiredMObjects": ["ParametricFunction", "Axes"],
                "RequiredAnimations": ["Create", "Write"]
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1761076391/BooleanOperations_bl9afi.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769189038/Screenshot_2026-01-23_at_10.51.57_PM_pfzsin.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "BooleanOperations_bl9afi.mp4",
            },
        ],
        
        "planner_summary": "I've crafted one scene, Boolean Operations, showcasing a beautiful Boolean Operations, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Boolean Operations' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    
    "golden_mandala": {
        "prompts": [
            "Create a mandala pattern that draws itself from center outward with symmetrical petals and geometric patterns in gold and purple",
        ],
        
        "planner_output": [
            {
                "SceneName": "GoldenMandalaScene",
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
    },

    "z=f(x,y)": {
        "prompts": [
            "Create a 3D animation for a smooth mathematical surface defined by a scalar function z=f(x,y)",
        ],
        
        "planner_output": [
            {
                "SceneName": "Mathematical surface",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "Mathematical surface",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/image/upload/q_auto,f_auto,w_600/v1756999225/3d_calculus_ziwjza.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769189598/Screenshot_2026-01-23_at_10.56.45_PM_rz7ki0.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "v1756999225/3d_calculus_ziwjza.mp4",
            },
        ],
        
        "planner_summary": "I've crafted one scene, Mathematical surface, showcasing a Golden Mandala Pattern, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Mathematical surface' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },

    "Lorenz Attractor": {
        "prompts": [
            "Create a highly polished 3D Manim animation that visualizes the Lorenz Attractor in a cinematic and educational way.",
        ],
        
        "planner_output": [
            {
                "SceneName": "LorenzAttractor",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "LorenzAttractor",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1757006283/Lorenz_Attractor_Visualization_-_Simulation_of_Chaos_a.k.a_Butterfly_Effect_-_Visualization_101_1080p_h264_apudib.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769189596/Screenshot_2026-01-23_at_10.56.54_PM_ieecpx.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "Lorenz_Attractor_Visualization_-_Simulation_of_Chaos_a.k.a_Butterfly_Effect_-_Visualization_101_1080p_h264_apudib.mp4",
            },
        ],
        
        "planner_summary": "I've crafted one scene, Lorenz Attractor, showcasing a Golden Mandala Pattern, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Lorenz Attractor' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    "Kalman Filter": {
        "prompts": [
            "Create a highly polished 3D Manim animation that visualizes the Kalmna Filter in a cinematic and educational way.",
        ],
        
        "planner_output": [
            {
                "SceneName": "KalmanFilter",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "KalmanFilter",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/v1769684999/KalmanFilterDemo_ci3kwx.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769685131/Screenshot_2026-01-29_at_4.42.05_PM_j9awyn.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "KalmanFilterDemo_ci3kwx.mp4",
            },
        ],
        
        "planner_summary": "I've crafted one scene, KalmanFilter, showcasing a KalmanFilter Animation, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'KalmanFilter' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },

    "Binary Search Tree": {
        "prompts": [
            "Create a highly polished animation to visualize a Binary Search Tree whose structure morphs smoothly.",
        ],
        
        "planner_output": [
            {
                "SceneName": "BinarySearchTree",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "BinarySearchTree",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1757006850/tree_yoifqz.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769189596/Screenshot_2026-01-23_at_10.56.59_PM_hklm3w.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "tree_yoifqz.mp4",
            },
        ],
        
        "planner_summary": "I've crafted one scene, Binary Search Tree, showcasing a Golden Mandala Pattern, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Binary Search Tree' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
    },
    "Convex surface": {
        "prompts": [
            "Create a clean, cinematic 3D animation that visualizes a convex mathematical surface emerging from the xy-plane.",
        ],
        
        "planner_output": [
            {
                "SceneName": "ConvexSurface",
                "Prompt": "",
                "RequiredMObjects": ["Circle", "Polygon", "VGroup"],
                "RequiredAnimations": ["Create", "Rotate", "FadeIn"]
            },
        ],
        
        "scenes_with_code": [
            {
                "sceneName": "ConvexSurface",
                "code": """""",
                "description": "",
                "RequiredMObjects": [],
                "RequiredAnimations": []
            },
        ],
        
        "cloudinary_metadata": [
            {
                "url": "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1756990356/ezgif-1c22e6dbdda273_frao3j.mp4",
                "thumbnail": "https://res.cloudinary.com/dloh4tkp5/image/upload/v1769189596/Screenshot_2026-01-23_at_10.57.06_PM_rm49ez.png",
                "width": 1920,
                "height": 1080,
                "duration": 5,
                "bytes": 1234567,
                "public_id": "ezgif-1c22e6dbdda273_frao3j",
            },
        ],
        
        "planner_summary": "I've crafted one scene, Convex Surface, showcasing a Golden Mandala Pattern, its title, and equations. Expect a soothing animation revealing its elegant form.",
        "final_summary": "I successfully created your 'Convex Surface' video! The scene rendered beautifully without any issues. I'm thrilled with the result and hope you are too!"
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
