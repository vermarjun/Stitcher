from fastapi import FastAPI
from contextlib import asynccontextmanager

from config.environment import PROJECT_VERSION, PROJECT_DESCRIPTION, PROJECT_NAME

# database
from utils.connect_mongo import mongodb
from utils.connect_cloudinary import connect_cloudinary
from utils.initialize_redis import initializeRedis

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the application lifecycle"""
    # Startup code
    await mongodb.connect()
    connect_cloudinary()
    await initializeRedis()
    yield
    # Shutdown code
    await mongodb.close()

app = FastAPI(
    title=PROJECT_NAME,
    description=PROJECT_DESCRIPTION,
    version=PROJECT_VERSION,
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Import route modules
from api.generate import router as generate_router
from api.edit import router as edit_router

# Include routers
app.include_router(generate_router, prefix="/generate")
app.include_router(edit_router, prefix="/edit")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)