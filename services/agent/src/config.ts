import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function opt(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

function optInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

export const config = {
  agentApiKey: required("AGENT_API_KEY"),
  host: opt("HOST", "0.0.0.0"),
  port: optInt("PORT", 4000),
  nodeEnv: opt("NODE_ENV", "development"),

  redisUrl: opt("CHECKPOINT_REDIS_URL", "redis://localhost:6379"),

  defaultProvider: opt("DEFAULT_PROVIDER", "openai"),
  defaultModelPlanner: opt("DEFAULT_MODEL_PLANNER", "gpt-4o"),
  defaultModelCoder: opt("DEFAULT_MODEL_CODER", "gpt-4o"),
  defaultModelDebugger: opt("DEFAULT_MODEL_DEBUGGER", "gpt-4o"),

  openaiApiKey: process.env["OPENAI_API_KEY"],
  anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
  geminiApiKey: process.env["GEMINI_API_KEY"],
  openrouterApiKey: process.env["OPENROUTER_API_KEY"],
  groqApiKey: process.env["GROQ_API_KEY"],
  opencodeGoApiKey: process.env["OPENCODE_GO_API_KEY"],

  enableWebSearch: optBool("ENABLE_WEB_SEARCH", false),
  webSearchProvider: opt("WEB_SEARCH_PROVIDER", "tavily") as "tavily" | "serper" | "brave",
  tavilyApiKey: process.env["TAVILY_API_KEY"],
  serperApiKey: process.env["SERPER_API_KEY"],
  braveApiKey: process.env["BRAVE_API_KEY"],
  webSearchMaxCallsPerJob: optInt("WEB_SEARCH_MAX_CALLS_PER_JOB", 3),

  maxParallelScenes: optInt("MAX_PARALLEL_SCENES", 6),
  defaultMaxValidationRetries: optInt("DEFAULT_MAX_VALIDATION_RETRIES", 3),
  defaultTimeoutSec: optInt("DEFAULT_TIMEOUT_SEC", 120),
  maxCodeSizeBytes: optInt("MAX_CODE_SIZE_BYTES", 524288),

  promptVersionPlanner: opt("PROMPT_VERSION_PLANNER", "active"),
  promptVersionCoder: opt("PROMPT_VERSION_CODER", "active"),
  promptVersionDebugger: opt("PROMPT_VERSION_DEBUGGER", "active"),
  promptVersionRefiner: opt("PROMPT_VERSION_REFINER", "active"),

  logLevel: opt("LOG_LEVEL", "info"),
  captureLlmIo: optBool("CAPTURE_LLM_IO", false),
  llmIoSink: opt("LLM_IO_SINK", "local"),
  llmIoLocalPath: opt("LLM_IO_LOCAL_PATH", "./llm_captures"),
  langfuseSecretKey: process.env["LANGFUSE_SECRET_KEY"],
  langfusePublicKey: process.env["LANGFUSE_PUBLIC_KEY"],
  langfuseHost: opt("LANGFUSE_HOST", "https://cloud.langfuse.com"),

  manimApiIndexPath: opt(
    "MANIM_API_INDEX_PATH",
    path.join(__dirname, "assets", "manim_api_index.json")
  ),
  ruffConfigPath: opt(
    "RUFF_CONFIG_PATH",
    path.join(__dirname, "assets", "ruff_manim.toml")
  ),
  pythonPath: opt("PYTHON_PATH", "python3"),
} as const;
