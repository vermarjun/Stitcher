import os
from typing import Dict, Optional
from dotenv import load_dotenv

from openai import AsyncOpenAI

from agents import (
    Model,
    OpenAIChatCompletionsModel,
    ModelProvider, 
    set_tracing_disabled
)

load_dotenv()

set_tracing_disabled(disabled=True)

import cloudinary
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")

def connect_cloudinary():
    cloudinary.config(
        cloud_name = CLOUDINARY_CLOUD_NAME,
        api_key = CLOUDINARY_API_KEY,
        api_secret = CLOUDINARY_API_SECRET,
        secure=True
    )
    # print("Cloudinary connected!")

connect_cloudinary()

# Model configurations
MODEL_CONFIGS = {
    "CODER": {
        "base_url": os.getenv("CODER_BASE_URL"),
        "api_key": os.getenv("CODER_API_KEY"),
        "model_name": os.getenv("CODER_MODEL_NAME")
    },
    "PLANNER": {
        "base_url": os.getenv("PLANNER_BASE_URL"),
        "api_key": os.getenv("PLANNER_API_KEY"),
        "model_name": os.getenv("PLANNER_MODEL_NAME")
    },
    "REVIEWER": {
        "base_url": os.getenv("REVIEWER_BASE_URL"),
        "api_key": os.getenv("REVIEWER_API_KEY"),
        "model_name": os.getenv("REVIEWER_MODEL_NAME")
    },
    "DEBUGGER": {
        "base_url": os.getenv("DEBUGGER_BASE_URL"),
        "api_key": os.getenv("DEBUGGER_API_KEY"),
        "model_name": os.getenv("DEBUGGER_MODEL_NAME")
    }
}

# Validate that all required environment variables are set
for model_type, config in MODEL_CONFIGS.items():
    if not config["base_url"] or not config["api_key"] or not config["model_name"]:
        raise ValueError(
            f"Please set {model_type.upper()}_BASE_URL and {model_type.upper()}_API_KEY via env var."
        )

# Create clients for each model
clients = {}
for model_type, config in MODEL_CONFIGS.items():
    clients[model_type] = AsyncOpenAI(
        base_url=config["base_url"], 
        api_key=config["api_key"]
    )

class MultiModelProvider(ModelProvider):
    def __init__(self):
        self.models: Dict[str, Model] = {}
        
    def get_model(self, model_type: str) -> Model:
        """
        Get a model by type ("CODER", "PLANNER", "DEBUGGER", "REVIEWER")
        
        Args:
            model_type: Predefined model type
            
        Returns:
            Model instance
        """
        if model_type not in MODEL_CONFIGS:
            raise ValueError(f"Unknown model type: {model_type}. Available types: {list(MODEL_CONFIGS.keys())}")
        
        # Cache models to avoid creating duplicates
        if model_type not in self.models:
            config = MODEL_CONFIGS[model_type]
            self.models[model_type] = OpenAIChatCompletionsModel(
                model=config["model_name"], 
                openai_client=clients[model_type]
            )
        
        return self.models[model_type]
    
    def get_available_models(self) -> list:
        """Get list of available model types"""
        return list(MODEL_CONFIGS.keys())

# Create the multi-model provider
MULTI_MODEL_PROVIDER = MultiModelProvider()

# Example usage functions:
# async def use_coder_model(prompt: str) -> str:
#     model = MULTI_MODEL_PROVIDER.get_model("CODER")
#     return await model.generate(prompt)
