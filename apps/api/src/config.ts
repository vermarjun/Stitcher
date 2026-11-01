import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Empty strings in a .env file ("FOO=") count as unset.
const optionalString = z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const requiredString = (name: string) =>
    z
        .string({ error: `${name} is required` })
        .trim()
        .min(1, `${name} is required`);

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().trim().min(1).default("3000"),
    // Mount point for every route, e.g. "/api". Use "" to mount at the root.
    API_PREFIX: z
        .string()
        .default("/api")
        .transform((v) => {
            const t = v.trim().replace(/\/+$/, "");
            if (t === "") return "";
            return t.startsWith("/") ? t : `/${t}`;
        }),
    ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
    // Public URL of the web app. Used in email links. Defaults to the first ALLOWED_ORIGINS entry.
    PUBLIC_APP_URL: optionalString,
    // Public URL of this API (no prefix). Used to build media URLs for local storage.
    PUBLIC_API_URL: optionalString,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    // ── Required ─────────────────────────────────────────────────────────────
    MONGODB_URL: requiredString("MONGODB_URL"),
    JWT_SECRET: z
        .string({ error: "JWT_SECRET is required" })
        .min(32, "JWT_SECRET must be at least 32 characters (try: openssl rand -hex 32)"),

    REDIS_HOST: requiredString("REDIS_HOST"),
    REDIS_PORT: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 6379)),
    REDIS_PASSWORD: z.string().optional().default(""),

    RAG_SERVICE_URL: requiredString("RAG_SERVICE_URL"),
    RAG_API_KEY: requiredString("RAG_API_KEY"),
    AGENT_SERVICE_URL: requiredString("AGENT_SERVICE_URL"),
    AGENT_API_KEY: requiredString("AGENT_API_KEY"),
    RENDER_SERVICE_URL: requiredString("RENDER_SERVICE_URL"),
    RENDER_API_KEY: requiredString("RENDER_API_KEY"),

    // ── Email ────────────────────────────────────────────────────────────────
    // console: print messages (and OTP codes) to the log. smtp: any SMTP server.
    // gmail: SMTP preset for smtp.gmail.com (use an app password as SMTP_PASS).
    EMAIL_PROVIDER: z.enum(["console", "smtp", "gmail"]).default("console"),
    SMTP_HOST: optionalString,
    SMTP_PORT: optionalString,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    EMAIL_FROM: optionalString,

    // ── Google sign-in (optional) ────────────────────────────────────────────
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    // ── Storage ──────────────────────────────────────────────────────────────
    STORAGE: z.enum(["local", "cloudinary"]).default("local"),
    STORAGE_DIR: z.string().default("./data/media"),
    MAX_UPLOAD_MB: z
        .string()
        .optional()
        .transform((v) => {
            const n = v ? parseInt(v, 10) : NaN;
            return Number.isFinite(n) && n > 0 ? n : 500;
        }),
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,

    // ── LLM providers (read by src/providers.config.ts) ──────────────────────
    LLM_PROVIDER: z.string().default("openai"),
    LLM_MODEL: optionalString,
    LLM_API_KEY: optionalString,
    LLM_BASE_URL: optionalString,
    CODER_PROVIDER: optionalString,
    CODER_MODEL: optionalString,
    CODER_API_KEY: optionalString,
    CODER_BASE_URL: optionalString,
    DEBUGGER_PROVIDER: optionalString,
    DEBUGGER_MODEL: optionalString,
    DEBUGGER_API_KEY: optionalString,
    DEBUGGER_BASE_URL: optionalString,
    QUERY_TRANSFORM_PROVIDER: optionalString,
    QUERY_TRANSFORM_MODEL: optionalString,
    QUERY_TRANSFORM_API_KEY: optionalString,
    QUERY_TRANSFORM_BASE_URL: optionalString,
    EMBEDDER_PROVIDER: optionalString,
    EMBEDDER_MODEL: optionalString,
    EMBEDDER_API_KEY: optionalString,
    EMBEDDER_BASE_URL: optionalString,

    // ── Voiceover (TTS) ──────────────────────────────────────────────────────
    TTS_PROVIDER: z.string().default("gtts"),
    AZURE_SPEECH_KEY: optionalString,
    AZURE_SPEECH_REGION: optionalString,
    DEFAULT_VOICEOVER_VOICE: optionalString,
    DEFAULT_VOICEOVER_LANG: z.string().default("en"),

    // ── Observability (OpenTelemetry), read by src/instrumentation.ts ────────
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
    OTEL_SERVICE_NAME: z.string().default("stitcher-api"),
    OTEL_TRACES_SAMPLER: optionalString,
});

export type AppConfig = z.infer<typeof envSchema>;

/** Names of every variable config.ts reads. */
export const ENV_KEYS: string[] = Object.keys(envSchema.shape);

export type ParseEnvResult =
    | { ok: true; data: AppConfig }
    | { ok: false; issues: string[] };

/** Validate an environment object. Pure: does not read process.env or exit. */
export function parseEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): ParseEnvResult {
    const parsed = envSchema.safeParse(env);
    if (parsed.success) {
        const data = parsed.data;
        if (data.STORAGE === "cloudinary") {
            const missing = (["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const).filter(
                (k) => !data[k]
            );
            if (missing.length > 0) {
                return {
                    ok: false,
                    issues: missing.map((k) => `${k}: required when STORAGE=cloudinary`),
                };
            }
        }
        return { ok: true, data };
    }
    return {
        ok: false,
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
}

const result = parseEnv(process.env);

if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
        `[config] Invalid environment variables:\n${result.issues.map((i) => `  ${i}`).join("\n")}\n` +
            `See apps/api/.env.example for the full list.`
    );
    process.exit(1);
}

export const config = result.data;

export const PORT = config.PORT;
export const JWT_SECRET = config.JWT_SECRET;
export const MONGODB_URL = config.MONGODB_URL;
export const API_PREFIX = config.API_PREFIX;
export const PUBLIC_APP_URL = (config.PUBLIC_APP_URL || config.ALLOWED_ORIGINS.split(",")[0].trim()).replace(/\/+$/, "");
export const PUBLIC_API_URL = (config.PUBLIC_API_URL || `http://localhost:${config.PORT}`).replace(/\/+$/, "");

export const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET;

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

// Email Verification Configuration
export const EMAIL_VERIFICATION_CONFIG = {
    tokenExpiry: 1000 * 60 * 60 * 24, // 24 hours
    tokenLength: 32,
};

// Email configuration, consumed by the pluggable sender in src/email/.
export const EMAIL_CONFIG = {
    provider: config.EMAIL_PROVIDER,
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ? parseInt(config.SMTP_PORT, 10) : undefined,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
    from: config.EMAIL_FROM || (config.SMTP_USER ? `Stitcher <${config.SMTP_USER}>` : "Stitcher <no-reply@localhost>"),
};

export const CLOUDINARY_CONFIG = {
    cloud_name: config.CLOUDINARY_CLOUD_NAME ?? "",
    api_key: config.CLOUDINARY_API_KEY ?? "",
    api_secret: config.CLOUDINARY_API_SECRET ?? "",
};
