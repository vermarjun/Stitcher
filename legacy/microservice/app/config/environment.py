import os
from dotenv import load_dotenv

load_dotenv()

PROJECT_NAME: str = "FASTAPI manim render service"
PROJECT_DESCRIPTION: str = "FASTAPI service to render mp4 videos based on generated code"
PROJECT_VERSION: str = "0.1.0"

API_V1_STR: str = "/api/v1"

# Database
MONGO_URL = os.getenv("DATABASE_URL")
MONGO_NAME = os.getenv("DATABASE_NAME")

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
    