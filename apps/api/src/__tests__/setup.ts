/**
 * Global test setup — stubs all required environment variables so that
 * importing src/config.ts in tests does not call process.exit(1).
 *
 * This file is loaded by vitest before any test file runs (see setupFiles in
 * vitest.config.ts).  All values are fake; no real credentials here.
 */

// Must be set before config.ts is imported anywhere in the test suite.
process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.API_PREFIX = "/api";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";
process.env.LOG_LEVEL = "error"; // keep test output quiet

// Auth
process.env.JWT_SECRET = "test_secret_min_16_chars_xxxxxxx";

// MongoDB (not used in unit tests — no real connection made)
process.env.MONGODB_URL = "mongodb://localhost:27017/stitcher_test";

// Email (not used in unit tests)
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_APP_PASSWORD = "test_email_password_1234";

// Cloudinary (not used in unit tests)
process.env.CLOUDINARY_CLOUD_NAME = "test_cloud_name_stub";
process.env.CLOUDINARY_API_KEY = "test_cloudinary_api_key";
process.env.CLOUDINARY_API_SECRET = "test_cloudinary_api_secret";

// Google OAuth (not used in unit tests)
process.env.GOOGLE_CLIENT_ID = "test_google_client_id_stub";
process.env.GOOGLE_CLIENT_SECRET = "test_google_client_secret_stub";

// Razorpay (not used in unit tests)
process.env.RZP_KEY_ID = "test_rzp_key_id_stub";
process.env.RZP_KEY_SECRET = "test_rzp_key_secret_stub";

// Redis (not used in unit tests)
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.REDIS_PASSWORD = "test_redis_password_stub";

// External service URLs + API keys
process.env.RAG_SERVICE_URL = "http://localhost:7000";
process.env.RAG_API_KEY = "test_rag_api_key_stub_xxxx";
process.env.AGENT_SERVICE_URL = "http://localhost:4000";
process.env.AGENT_API_KEY = "test_agent_api_key_stub_xxx";
process.env.RENDER_SERVICE_URL = "http://localhost:8000";
process.env.RENDER_API_KEY = "test_render_api_key_stub_xx";

// 64-character hex key for AES-256-GCM (32 bytes)
process.env.KEYS_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
