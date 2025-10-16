import os
from typing import Dict, Optional, Any
from contextlib import asynccontextmanager
import contextvars
from openai import AsyncOpenAI
from agents import (
    Model,
    OpenAIChatCompletionsModel,
    ModelProvider, 
    set_tracing_disabled
)

set_tracing_disabled(disabled=True)

# Context variable to store request-specific configuration
request_config = contextvars.ContextVar('request_config', default=None)

class RequestScopedModelProvider(ModelProvider):
    """
    A model provider that creates models based on request-specific API configurations.
    Each request gets its own isolated set of models with their own API keys.
    """
    
    def __init__(self, api_config: Dict[str, str]):
        """
        Initialize provider with request-specific configuration.
        
        Args:
            api_config: Dictionary containing API keys, base URLs, and model names
                       from the request headers
        """
        self.api_config = api_config
        self.models: Dict[str, Model] = {}
        self.clients: Dict[str, AsyncOpenAI] = {}
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Create OpenAI clients for each model type based on request configuration."""
        model_types = ["PLANNER", "GENERATOR", "MERGER", "DEBUGGER", "GENERAL"]
        
        for model_type in model_types:
            base_url_key = f"{model_type}_BASE_URL"
            api_key_key = f"{model_type}_API_KEY"
            
            if base_url_key in self.api_config and api_key_key in self.api_config:
                print(model_type," ", "initialized with: api_key= ", self.api_config[api_key_key], " and base_url= ", self.api_config[base_url_key])
                self.clients[model_type] = AsyncOpenAI(
                    base_url=self.api_config[base_url_key],
                    api_key=self.api_config[api_key_key]
                )
    
    def get_model(self, model_type: str) -> Model:
        """
        Get a model by type for the current request.
        
        Args:
            model_type: Model type ("PLANNER", "GENERATOR", "MERGER", "DEBUGGER", "GENERAL")
            
        Returns:
            Model instance configured with request-specific API keys
        """
        if model_type not in self.clients:
            raise ValueError(
                f"Model type '{model_type}' not configured for this request. "
                f"Available types: {list(self.clients.keys())}"
            )
        
        # Cache models within the request scope to avoid duplicates
        if model_type not in self.models:
            model_name_key = f"{model_type}_MODEL"
            model_name = self.api_config.get(model_name_key)
            
            if not model_name:
                raise ValueError(f"Model name not provided for {model_type}")
            
            self.models[model_type] = OpenAIChatCompletionsModel(
                model=model_name,
                openai_client=self.clients[model_type]
            )
        
        return self.models[model_type]
    
    def get_available_models(self) -> list:
        """Get list of available model types for this request."""
        return list(self.clients.keys())
    
    def cleanup(self):
        """Clean up resources when request is complete."""
        self.models.clear()
        self.clients.clear()


class MultiTenantModelManager:
    """
    Manager class that handles the lifecycle of request-scoped model providers.
    This ensures each request gets its own isolated provider with its own API keys.
    """
    
    @staticmethod
    def create_provider(api_config: Dict[str, str]) -> RequestScopedModelProvider:
        """
        Create a new provider for a specific request.
        
        Args:
            api_config: Request-specific API configuration
            
        Returns:
            New RequestScopedModelProvider instance
        """
        return RequestScopedModelProvider(api_config)
    
    @staticmethod
    def set_request_provider(provider: RequestScopedModelProvider):
        """
        Set the provider for the current request context.
        
        Args:
            provider: The provider to use for this request
        """
        request_config.set(provider)
    
    @staticmethod
    def get_current_provider() -> Optional[RequestScopedModelProvider]:
        """
        Get the provider for the current request context.
        
        Returns:
            Current request's provider or None if not set
        """
        return request_config.get()
    
    @staticmethod
    @asynccontextmanager
    async def request_scope(api_config: Dict[str, str]):
        """
        Context manager for handling request-scoped providers.
        
        Usage:
            async with MultiTenantModelManager.request_scope(api_config) as provider:
                model = provider.get_model("PLANNER")
                response = await model.generate(prompt)
        """
        provider = MultiTenantModelManager.create_provider(api_config)
        token = request_config.set(provider)
        try:
            yield provider
        finally:
            provider.cleanup()
            request_config.reset(token)


# Convenience function to get models within request context
def get_model(model_type: str) -> Model:
    """
    Get a model for the current request context.
    
    Args:
        model_type: Type of model to retrieve
        
    Returns:
        Model instance
        
    Raises:
        RuntimeError: If called outside of request context
    """
    provider = MultiTenantModelManager.get_current_provider()
    if not provider:
        raise RuntimeError(
            "No model provider in current context. "
            "This function must be called within a request scope."
        )
    return provider.get_model(model_type)


# Example usage in FastAPI endpoint
async def example_endpoint_usage(request):
    """
    Example of how to use the multi-tenant model provider in an endpoint.
    """
    # Get API configuration from request state (set by middleware)
    api_config = request.state.api_config
    
    # Use the request-scoped provider
    async with MultiTenantModelManager.request_scope(api_config) as provider:
        # Get models configured with this request's API keys
        planner_model = provider.get_model("PLANNER")
        generator_model = provider.get_model("GENERATOR")
        
        # Use the models
        planning_response = await planner_model.generate("Create a plan...")
        generation_response = await generator_model.generate("Generate code...")
        
        return {
            "plan": planning_response,
            "code": generation_response
        }