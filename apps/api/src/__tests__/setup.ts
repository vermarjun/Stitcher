/**
 * Global test setup: sets the minimal required environment so that importing
 * src/config.ts in tests does not call process.exit(1).
 *
 * This file is loaded by vitest before any test file runs (see setupFiles in
 * vitest.config.ts). All values are fake; no real credentials here.
 */

// Must be set before config.ts is imported anywhere in the test suite.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // keep test output quiet

// Required
process.env.MONGODB_URL = "mongodb://localhost:27017/stitcher_test";
process.env.REDIS_HOST = "localhost";
process.env.JWT_SECRET = "test_secret_at_least_32_chars_long_xxxxxxx";
process.env.RAG_SERVICE_URL = "http://localhost:7000";
process.env.RAG_API_KEY = "test_rag_api_key_stub_xxxx";
process.env.AGENT_SERVICE_URL = "http://localhost:4000";
process.env.AGENT_API_KEY = "test_agent_api_key_stub_xxx";
process.env.RENDER_SERVICE_URL = "http://localhost:8000";
process.env.RENDER_API_KEY = "test_render_api_key_stub_xx";

// Never let a developer's real .env leak into the tests.
for (const key of [
    "LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY", "LLM_BASE_URL",
    "STORAGE", "STORAGE_DIR", "EMAIL_PROVIDER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
]) {
    delete process.env[key];
}
