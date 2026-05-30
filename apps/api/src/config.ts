import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().min(1),
    API_PREFIX: z.string().default(""),
    ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
    // Public-facing frontend base URL used to build share links (/v/:shareId).
    // Falls back to the first ALLOWED_ORIGINS entry when unset.
    PUBLIC_APP_URL: z.string().optional(),
    // v1 relaunch keeps the community surface (feed, posts, follows,
    // leaderboard, backpack, notifications) dormant. Set "true" to re-enable.
    FEATURE_COMMUNITY: z.string().optional().default("false"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    MONGODB_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),

    EMAIL_USER: z.string().min(1),
    EMAIL_APP_PASSWORD: z.string().min(1),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    RZP_KEY_ID: z.string().min(1),
    RZP_KEY_SECRET: z.string().min(1),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 6379)),
    REDIS_PASSWORD: z.string().optional().default(""),

    RAG_SERVICE_URL: z.string().min(1),
    RAG_API_KEY: z.string().min(1),
    AGENT_SERVICE_URL: z.string().min(1),
    AGENT_API_KEY: z.string().min(1),
    RENDER_SERVICE_URL: z.string().min(1),
    RENDER_API_KEY: z.string().min(1),

    // OpenCode Go — OpenAI-completions-compatible LLM backend, used directly by
    // the API for lightweight calls (e.g. memory reflection). Optional so the
    // app still boots without it; memory reflection no-ops when the key is absent.
    OPENCODE_GO_API_KEY: z.string().optional().default(""),
    OPENCODE_GO_DEFAULT_MODEL: z.string().optional().default("glm-5.1"),

    KEYS_ENCRYPTION_KEY: z
        .string()
        .length(64, 'KEYS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
        .regex(/^[0-9a-fA-F]{64}$/, 'KEYS_ENCRYPTION_KEY must be a 64-character hex string'),

    // ── Observability (OpenTelemetry) — all optional so boot never fails ──────
    // Consumed by src/instrumentation.ts (loaded via `node -r` before app code).
    // Endpoint defaults to http://localhost:4318 there if unset.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().optional().default("stitcher-api"),
    OTEL_TRACES_SAMPLER: z.string().optional(),
    // Gates the bull-board admin dashboard at ${API_PREFIX}/admin/queues.
    // Must be "true" AND the request must pass JWT auth to access the board.
    ADMIN_DASHBOARD_ENABLED: z.string().optional().default("false"),

    // ── Native voiceover (TTS) — all optional; voiceover is feature-flagged OFF
    //    by default at the request layer, so missing Azure keys NEVER break boot.
    //    TTS_PROVIDER picks the default adapter; a per-request override
    //    (generationOptions.voiceover.provider) takes precedence in the worker.
    TTS_PROVIDER: z.string().optional().default("gtts"),
    AZURE_SPEECH_KEY: z.string().optional(),
    AZURE_SPEECH_REGION: z.string().optional(),
    DEFAULT_VOICEOVER_VOICE: z.string().optional(),
    DEFAULT_VOICEOVER_LANG: z.string().optional().default("en"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    // Format Zod errors as a readable list
    const issues = parsed.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
    // eslint-disable-next-line no-console
    console.error(`[config] Invalid environment variables:\n${issues}`);
    process.exit(1);
}

export const config = parsed.data;

// Named exports — kept for back-compat with existing controllers/utilities

// TODO (Phase B): generateChat.controller.ts still references this.
// It previously pointed to the deleted monolithic microservice; route it to
// AGENT_SERVICE_URL until the controller is rewritten in Phase B.
export const MICROSERVICE_BASE_URL = config.AGENT_SERVICE_URL;

export const RZP_KEY_ID = config.RZP_KEY_ID;
export const RZP_KEY_SECRET = config.RZP_KEY_SECRET;
export const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET;
export const PORT = config.PORT;
export const JWT_SECRET = config.JWT_SECRET;
export const MONGODB_URL = config.MONGODB_URL;
export const API_PREFIX = config.API_PREFIX;
export const PUBLIC_APP_URL =
    config.PUBLIC_APP_URL || config.ALLOWED_ORIGINS.split(",")[0].trim();

// Feature flags. community gates the entire social surface for the v1 relaunch.
export const FEATURES = {
    community: config.FEATURE_COMMUNITY === "true",
};

// Observability: when true (and JWT auth passes) the bull-board queue dashboard
// is mounted at ${API_PREFIX}/admin/queues. See index.ts.
export const ADMIN_DASHBOARD_ENABLED = config.ADMIN_DASHBOARD_ENABLED === "true";
export const EMAIL_USER = config.EMAIL_USER;
export const EMAIL_APP_PASSWORD = config.EMAIL_APP_PASSWORD;
export const CLOUDINARY_API_KEY = config.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = config.CLOUDINARY_API_SECRET;
export const CLOUDINARY_CLOUD_NAME = config.CLOUDINARY_CLOUD_NAME;
export const REDIS_HOST = config.REDIS_HOST;
export const REDIS_PORT = config.REDIS_PORT;
export const REDIS_PASSWORD = config.REDIS_PASSWORD;

export interface JwtConfig {
    secret: string;
    expiresIn: string | number;
    algorithm: string;
}

// JWT Configuration
export const JWT_CONFIG = {
    secret: JWT_SECRET,
    expiresIn: "7d",
    algorithm: "HS256",
};

// Password Reset Configuration
export const PASSWORD_RESET_CONFIG = {
    tokenExpiry: 1000 * 60 * 30, // 30 minutes
    tokenLength: 32,
};

// Email Configuration
export const EMAIL_CONFIG = {
    service: "gmail",
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD,
};

export const CLOUDINARY_CONFIG = {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
};
