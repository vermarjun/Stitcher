import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { parseEnv, ENV_KEYS } from "../config";

const REQUIRED = {
    MONGODB_URL: "mongodb://localhost:27017/x",
    REDIS_HOST: "localhost",
    JWT_SECRET: "a".repeat(32),
    RAG_SERVICE_URL: "http://rag:7000",
    RAG_API_KEY: "k",
    AGENT_SERVICE_URL: "http://agent:4000",
    AGENT_API_KEY: "k",
    RENDER_SERVICE_URL: "http://render:8000",
    RENDER_API_KEY: "k",
};

describe("parseEnv", () => {
    it("boots with only the required variables and applies defaults", () => {
        const r = parseEnv(REQUIRED);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data.PORT).toBe("3000");
        expect(r.data.API_PREFIX).toBe("/api");
        expect(r.data.ALLOWED_ORIGINS).toBe("http://localhost:5173");
        expect(r.data.REDIS_PORT).toBe(6379);
        expect(r.data.EMAIL_PROVIDER).toBe("console");
        expect(r.data.STORAGE).toBe("local");
        expect(r.data.LLM_PROVIDER).toBe("openai");
        expect(r.data.TTS_PROVIDER).toBe("gtts");
        expect(r.data.GOOGLE_CLIENT_ID).toBeUndefined();
    });

    it("refuses a JWT_SECRET shorter than 32 characters", () => {
        const r = parseEnv({ ...REQUIRED, JWT_SECRET: "short" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.issues.join("\n")).toMatch(/JWT_SECRET must be at least 32 characters/);
    });

    it("accepts a JWT_SECRET of exactly 32 characters", () => {
        expect(parseEnv({ ...REQUIRED, JWT_SECRET: "x".repeat(32) }).ok).toBe(true);
    });

    it("reports every missing required variable", () => {
        const r = parseEnv({});
        expect(r.ok).toBe(false);
        if (r.ok) return;
        const text = r.issues.join("\n");
        for (const name of Object.keys(REQUIRED)) expect(text).toContain(name);
    });

    it("treats empty optional values as unset", () => {
        const r = parseEnv({ ...REQUIRED, GOOGLE_CLIENT_ID: "", LLM_API_KEY: "  " });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.data.GOOGLE_CLIENT_ID).toBeUndefined();
        expect(r.data.LLM_API_KEY).toBeUndefined();
    });

    it("normalises API_PREFIX", () => {
        const a = parseEnv({ ...REQUIRED, API_PREFIX: "v1/" });
        const b = parseEnv({ ...REQUIRED, API_PREFIX: "" });
        expect(a.ok && a.data.API_PREFIX).toBe("/v1");
        expect(b.ok && b.data.API_PREFIX).toBe("");
    });

    it("requires Cloudinary credentials only when STORAGE=cloudinary", () => {
        const r = parseEnv({ ...REQUIRED, STORAGE: "cloudinary" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.issues.join("\n")).toContain("CLOUDINARY_CLOUD_NAME");

        const ok = parseEnv({
            ...REQUIRED,
            STORAGE: "cloudinary",
            CLOUDINARY_CLOUD_NAME: "c",
            CLOUDINARY_API_KEY: "k",
            CLOUDINARY_API_SECRET: "s",
        });
        expect(ok.ok).toBe(true);
    });

    it("rejects an unknown EMAIL_PROVIDER", () => {
        expect(parseEnv({ ...REQUIRED, EMAIL_PROVIDER: "carrier-pigeon" }).ok).toBe(false);
    });
});

describe(".env.example", () => {
    const example = dotenv.parse(fs.readFileSync(path.join(__dirname, "../../.env.example")));
    // Read directly from process.env outside config.ts.
    const EXTRA = ["EXPORT_FFMPEG_PATH", "EXPORT_FONT_PATH", "TTS_MAX_CONCURRENCY"];

    it("lists every variable the config reads, and nothing else", () => {
        expect(Object.keys(example).sort()).toEqual([...ENV_KEYS, ...EXTRA].sort());
    });

    it("is a valid environment once copied to .env", () => {
        expect(parseEnv(example).ok).toBe(true);
    });
});
