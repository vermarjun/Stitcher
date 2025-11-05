import os
from dotenv import load_dotenv

load_dotenv()
PROJECT_NAME: str = "FASTAPI manim render service"
PROJECT_DESCRIPTION: str = "FASTAPI service to render mp4 videos based on generated code"
PROJECT_VERSION: str = "0.1.0"

API_V1_STR: str = "/api/v1"

# Database
MONGO_URL = os.getenv("DATABASE_URL")
print(MONGO_URL)
MONGO_NAME = os.getenv("DATABASE_NAME")
print(MONGO_NAME)

# REDIS
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT") or 0)
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")

# JWT settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# API settings
API_SERVICE_URL = os.getenv("API_SERVICE_URL")

# CORS
BACKEND_CORS_ORIGINS: list = ["*"]

VERMARJUN_API_KEY = os.getenv("VERMARJUN_API_KEY")
VERMARJUN_BASE_URL = os.getenv("VERMARJUN_BASE_URL")
VERMARJUN_MODEL_NAME = os.getenv("VERMARJUN_MODEL_NAME")

RANCOR_API_KEY = os.getenv("RANCOR_API_KEY")
RANCOR_BASE_URL = os.getenv("RANCOR_BASE_URL")
RANCOR_MODEL_NAME = os.getenv("RANCOR_MODEL_NAME")

DESTROYER_API_KEY = os.getenv("DESTROYER_API_KEY")
DESTROYER_BASE_URL = os.getenv("DESTROYER_BASE_URL")
DESTROYER_MODEL_NAME = os.getenv("DESTROYER_MODEL_NAME")

VERMARJUNWORK_API_KEY = os.getenv("VERMARJUNWORK_API_KEY")
VERMARJUNWORK_BASE_URL = os.getenv("VERMARJUNWORK_BASE_URL")
VERMARJUNWORK_MODEL_NAME = os.getenv("VERMARJUNWORK_MODEL_NAME")

INITIAL_CONFIGS = [
    {
        'email': "vermarjun26@gmail.com",
        'api_key': VERMARJUN_API_KEY,
        'model': VERMARJUN_MODEL_NAME,
        'base_url': VERMARJUN_BASE_URL 
    },
    {
        'email': "rancor26av@gmail.com",
        'api_key': RANCOR_API_KEY,
        'model': RANCOR_MODEL_NAME,
        'base_url': RANCOR_BASE_URL 
    },
    {
        'email': "destroyer26av@gmail.com",
        'api_key': DESTROYER_API_KEY,
        'model': DESTROYER_MODEL_NAME,
        'base_url': DESTROYER_BASE_URL 
    },
    {
        'email': "vermarjun.work@gmail.com",
        'api_key': VERMARJUNWORK_API_KEY,
        'model': VERMARJUNWORK_MODEL_NAME,
        'base_url': VERMARJUNWORK_BASE_URL 
    },
]

# Model providers
CODER_BASE_URL = os.getenv("CODER_BASE_URL")
CODER_API_KEY = os.getenv("CODER_API_KEY")
CODER_MODEL_NAME = os.getenv("CODER_MODEL_NAME")

PLANNER_BASE_URL = os.getenv("PLANNER_BASE_URL")
PLANNER_API_KEY = os.getenv("PLANNER_API_KEY")
PLANNER_MODEL_NAME = os.getenv("PLANNER_MODEL_NAME")

REVIEWER_BASE_URL = os.getenv("REVIEWER_BASE_URL")
REVIEWER_API_KEY = os.getenv("REVIEWER_API_KEY")
REVIEWER_MODEL_NAME = os.getenv("REVIEWER_MODEL_NAME")

DEBUGGER_BASE_URL = os.getenv("DEBUGGER_BASE_URL")
DEBUGGER_API_KEY = os.getenv("DEBUGGER_API_KEY")
DEBUGGER_MODEL_NAME = os.getenv("DEBUGGER_MODEL_NAME")

GPM_BASE_URL = os.getenv("GPM_BASE_URL")
GPM_API_KEY = os.getenv("GPM_API_KEY")
GPM_MODEL_NAME = os.getenv("GPM_MODEL_NAME")