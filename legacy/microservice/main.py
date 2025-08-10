from fastapi import FastAPI
from contextlib import asynccontextmanager

from config.environment import PROJECT_VERSION, PROJECT_DESCRIPTION, PROJECT_NAME

#databse
from database.connect_mongo import mongodb
from database.connect_cloudinary import connect_cloudinary

# Import route modules
from routes.generate import router as generate_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the application lifecycle"""
    # Startup code
    # load_dotenv()
    await mongodb.connect()
    connect_cloudinary()
    yield
    # Shutdown code
    await mongodb.close()

app = FastAPI(
    title = PROJECT_NAME,
    description = PROJECT_DESCRIPTION,
    version = PROJECT_VERSION,
    lifespan=lifespan
)

@app.get("/")
def read_root():
    return {"message": "Welcome to FastAPI!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(generate_router, prefix="/generate")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)