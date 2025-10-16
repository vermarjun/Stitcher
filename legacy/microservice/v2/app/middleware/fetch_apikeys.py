from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException
from typing import Dict
from utils.model_provider import MultiTenantModelManager  # Changed import

# Map of expected headers for the API keys
API_KEY_HEADERS = {
    "PLANNER_API_KEY": "x-planner-api-key",
    "PLANNER_BASE_URL": "x-planner-base-url",
    "GENERATOR_API_KEY": "x-generator-api-key",
    "GENERATOR_BASE_URL": "x-generator-base-url",
    "MERGER_API_KEY": "x-merger-api-key",
    "MERGER_BASE_URL": "x-merger-base-url",
    "DEBUGGER_API_KEY": "x-debugger-api-key",
    "DEBUGGER_BASE_URL": "x-debugger-base-url",
    "GENERAL_API_KEY": "x-general-api-key",
    "GENERAL_BASE_URL": "x-general-base-url",
}

MODEL_NAME_HEADERS = {
    "PLANNER_MODEL": "x-planner-model",
    "GENERATOR_MODEL": "x-generator-model",
    "MERGER_MODEL": "x-merger-model",
    "DEBUGGER_MODEL": "x-debugger-model",
    "GENERAL_MODEL": "x-general-model",
}

class ApiKeysMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts API keys from request headers and creates
    a request-scoped model provider for multi-tenant support.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip middleware for health check or other excluded paths
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Extract API keys and base URLs from headers
        api_config: Dict[str, str] = {}
        
        # Extract all API keys and base URLs
        for config_key, header_name in API_KEY_HEADERS.items():
            val = request.headers.get(header_name)
            if val:
                api_config[config_key] = val
        
        # Extract model names
        for config_key, header_name in MODEL_NAME_HEADERS.items():
            val = request.headers.get(header_name)
            if val:
                api_config[config_key] = val
        
        # Validate that we have at least the minimum required keys
        required_keys = [
            "PLANNER_API_KEY", "PLANNER_BASE_URL", "PLANNER_MODEL",
            "GENERATOR_API_KEY", "GENERATOR_BASE_URL", "GENERATOR_MODEL",
            "MERGER_API_KEY", "MERGER_BASE_URL", "MERGER_MODEL",
            "DEBUGGER_API_KEY", "DEBUGGER_BASE_URL", "DEBUGGER_MODEL",
            "GENERAL_API_KEY", "GENERAL_BASE_URL", "GENERAL_MODEL"
        ]
        
        missing_keys = [key for key in required_keys if key not in api_config]
        if missing_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required API configuration headers: {', '.join(missing_keys)}"
            )
        
        # Store config in request state for access in endpoints
        request.state.api_config = api_config
        
        # Create request-scoped provider and set it in context
        async with MultiTenantModelManager.request_scope(api_config):
            response = await call_next(request)
            
        return response