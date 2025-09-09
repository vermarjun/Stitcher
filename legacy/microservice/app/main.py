from fastapi import FastAPI
from contextlib import asynccontextmanager

from config.environment import PROJECT_VERSION, PROJECT_DESCRIPTION, PROJECT_NAME

#databse
from utils.connect_mongo import mongodb
from utils.connect_cloudinary import connect_cloudinary

from openai import OpenAI

# Import route modules
from api.generate import router as generate_router

# Updated System prompt for the Assistant
SYSTEM_PROMPT = """
You are an expert Manim animation code generator. Your task is to generate or modify Python code using the Manim library to create animations based on user prompts.

Important rules:
- Always output a JSON object with at least the key "code" containing the COMPLETE Python code for the Manim scene as a string, including all imports.
- The code must define exactly one class named AnimationScene that inherits from Scene (e.g., class AnimationScene(Scene):).
- If fixing an error, you may include an additional key "explanation" with a brief description of the fix.
- Do not include any other text or keys in the JSON.
- If the user provides a modification prompt and previous code, use the previous code as a base and apply the changes, then output the full updated code.
- If an error is reported, analyze the error and fix the code accordingly, then output the fixed full code in JSON.
- Ensure the code is valid Python and Manim-compatible. Common issues: missing imports, syntax errors, undefined variables, incorrect Manim methods.
- Assume Manim is installed and use standard Manim constructs like self.play, self.add, etc.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the application lifecycle"""
    # Startup code
    await mongodb.connect()
    connect_cloudinary()
    app.state.openai_client = OpenAI()
    app.state.manim_assistant = app.state.openai_client.beta.assistants.create(
        name="Manim Animation Generator",
        instructions=SYSTEM_PROMPT,
        model="gpt-5",  # Updated to latest model as of September 2025
        tools=[]  # No additional tools needed for code generation
    )
    yield
    # Shutdown code
    await mongodb.close()

app = FastAPI(
    title = PROJECT_NAME,
    description = PROJECT_DESCRIPTION,
    version = PROJECT_VERSION,
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers
app.include_router(generate_router, prefix="/generate")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
