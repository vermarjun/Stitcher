/**
 * smoke.ts — end-to-end smoke test for the Stitcher backend.
 *
 * Usage:
 *   npm run smoke            # Full live run (talks to real services)
 *   npm run smoke:mock       # Pre-flight only — no LLM credits burned
 *   SMOKE_MOCK=true tsx scripts/smoke.ts
 *
 * Required env (same .env that the API uses):
 *   MONGODB_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 *   RAG_SERVICE_URL, AGENT_SERVICE_URL, RENDER_SERVICE_URL
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   JWT_SECRET, API_PREFIX
 *
 * Optional env:
 *   SMOKE_API_BASE_URL   Target API (default: http://localhost:3000)
 *   SMOKE_TIMEOUT_SEC    Max seconds to wait for job_complete (default: 300)
 */

import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import mongoose from "mongoose";
import Redis from "ioredis";
import { spawnSync } from "child_process";
import { io as SocketIOClient, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ─── CLI flags & env ──────────────────────────────────────────────────────────

const MOCK_MODE =
    process.argv.includes("--mock") || process.env["SMOKE_MOCK"] === "true";

const API_BASE = (
    process.env["SMOKE_API_BASE_URL"] ?? "http://localhost:3000"
).replace(/\/$/, "");

const API_PREFIX = process.env["API_PREFIX"] ?? "";

const TIMEOUT_SEC = parseInt(process.env["SMOKE_TIMEOUT_SEC"] ?? "300", 10);

// ─── Minimal env reads (no config import — avoids zod exit on missing vars) ───

const MONGODB_URL    = process.env["MONGODB_URL"]    ?? "";
const REDIS_HOST     = process.env["REDIS_HOST"]     ?? "localhost";
const REDIS_PORT     = parseInt(process.env["REDIS_PORT"] ?? "6379", 10);
const REDIS_PASSWORD = process.env["REDIS_PASSWORD"] ?? "";
const RAG_URL        = process.env["RAG_SERVICE_URL"]    ?? "";
const AGENT_URL      = process.env["AGENT_SERVICE_URL"]  ?? "";
const RENDER_URL     = process.env["RENDER_SERVICE_URL"] ?? "";
const JWT_SECRET     = process.env["JWT_SECRET"]     ?? "";

const CLOUDINARY_CLOUD_NAME  = process.env["CLOUDINARY_CLOUD_NAME"]  ?? "";
const CLOUDINARY_API_KEY     = process.env["CLOUDINARY_API_KEY"]     ?? "";
const CLOUDINARY_API_SECRET  = process.env["CLOUDINARY_API_SECRET"]  ?? "";

// ─── Timing helpers ───────────────────────────────────────────────────────────

const startedAt = Date.now();

function elapsed(): string {
    return `+${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function pass(msg: string): void {
    console.log(`[smoke] PASS: ${msg}`);
}

function fail(msg: string): void {
    console.log(`[smoke] FAIL: ${msg}`);
}

function info(msg: string): void {
    console.log(`[smoke] INFO: ${msg}`);
}

// ─── Pre-flight check helpers ─────────────────────────────────────────────────

/** Returns null on success, or an error string on failure. */
type CheckFn = () => Promise<string | null>;

interface Check {
    name: string;
    fn: CheckFn;
}

async function checkMongo(): Promise<string | null> {
    if (!MONGODB_URL) {
        return (
            "MONGODB_URL is not set. " +
            'Add it to your .env: MONGODB_URL="mongodb://localhost:27017/stitcher"'
        );
    }
    let conn: mongoose.Connection | null = null;
    try {
        await mongoose.connect(MONGODB_URL, { serverSelectionTimeoutMS: 5000 });
        conn = mongoose.connection;
        await conn.db!.admin().ping();
        return null;
    } catch (err) {
        return (
            `Mongo at ${MONGODB_URL} unreachable: ${String(err)}. ` +
            "Start it with: docker run -d -p 27017:27017 mongo:7"
        );
    }
    // Keep connection open for auth-setup step; caller disconnects at cleanup.
}

async function checkRedis(): Promise<string | null> {
    if (!REDIS_HOST) {
        return (
            "REDIS_HOST is not set. " +
            "Add it to your .env: REDIS_HOST=localhost"
        );
    }
    const redis = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD || undefined,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
    });
    try {
        await redis.connect();
        const pong = await redis.ping();
        if (pong !== "PONG") {
            return `Redis at ${REDIS_HOST}:${REDIS_PORT} returned unexpected ping response: ${pong}`;
        }
        return null;
    } catch (err) {
        return (
            `Redis at ${REDIS_HOST}:${REDIS_PORT} unreachable: ${String(err)}. ` +
            "Start it with: docker run -d -p 6379:6379 redis:7"
        );
    } finally {
        redis.disconnect();
    }
}

async function checkServiceHealth(name: string, envVarName: string, url: string): Promise<string | null> {
    if (!url) {
        return (
            `${envVarName} is not set. ` +
            `Add it to your .env (e.g. ${envVarName}=http://localhost:800X)`
        );
    }
    const healthUrl = url.replace(/\/$/, "") + "/health";
    try {
        const res = await axios.get(healthUrl, { timeout: 5000 });
        if (res.status < 200 || res.status >= 300) {
            return `${name} health check at ${healthUrl} returned HTTP ${res.status}`;
        }
        return null;
    } catch (err) {
        return (
            `${name} at ${healthUrl} unreachable: ${String(err)}. ` +
            "Make sure the service is running (see docker-compose.yml)."
        );
    }
}

async function checkRag(): Promise<string | null> {
    return checkServiceHealth("RAG service", "RAG_SERVICE_URL", RAG_URL);
}

async function checkAgent(): Promise<string | null> {
    return checkServiceHealth("Agent service", "AGENT_SERVICE_URL", AGENT_URL);
}

async function checkRender(): Promise<string | null> {
    return checkServiceHealth("Render service", "RENDER_SERVICE_URL", RENDER_URL);
}

async function checkCloudinary(): Promise<string | null> {
    const missing: string[] = [];
    if (!CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
    if (!CLOUDINARY_API_KEY)    missing.push("CLOUDINARY_API_KEY");
    if (!CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");
    if (missing.length > 0) {
        return (
            `Cloudinary credentials missing: ${missing.join(", ")}. ` +
            "Add them to your .env (get them from https://console.cloudinary.com)."
        );
    }
    return null;
}

async function checkFfmpeg(): Promise<string | null> {
    const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    if (result.status !== 0 || result.error) {
        return (
            "ffmpeg not found or failed to run. " +
            "Install it: brew install ffmpeg  (macOS) / apt-get install ffmpeg  (Debian/Ubuntu)"
        );
    }
    return null;
}

async function checkJwtSecret(): Promise<string | null> {
    if (!JWT_SECRET) {
        return (
            "JWT_SECRET is not set. " +
            "Add it to your .env: JWT_SECRET=<long random string>"
        );
    }
    return null;
}

// ─── Pre-flight runner ────────────────────────────────────────────────────────

const CHECKS: Check[] = [
    { name: "MongoDB",        fn: checkMongo       },
    { name: "Redis",          fn: checkRedis       },
    { name: "RAG service",    fn: checkRag         },
    { name: "Agent service",  fn: checkAgent       },
    { name: "Render service", fn: checkRender      },
    { name: "Cloudinary",     fn: checkCloudinary  },
    { name: "ffmpeg",         fn: checkFfmpeg      },
    { name: "JWT_SECRET",     fn: checkJwtSecret   },
];

async function runPreflightChecks(): Promise<boolean> {
    info("Running pre-flight checks...");
    const failures: string[] = [];

    for (const check of CHECKS) {
        const error = await check.fn();
        if (error) {
            fail(`pre-flight: ${check.name} — ${error}`);
            failures.push(check.name);
        } else {
            pass(`pre-flight: ${check.name}`);
        }
    }

    if (failures.length > 0) {
        console.log(
            `\n[smoke] Pre-flight FAILED for: ${failures.join(", ")}. ` +
            "Fix the issues above and re-run.\n"
        );
        return false;
    }

    pass("All pre-flight checks passed.");
    return true;
}

// ─── Auth setup ───────────────────────────────────────────────────────────────

const TEST_EMAIL    = "smoke-test@stitcher.dev";
const TEST_PASSWORD = "SmokeTest!2024";
const TEST_USERNAME = "smoke_test_user";

interface LeanUser {
    _id: mongoose.Types.ObjectId;
    isTestAccount: boolean;
}

async function setupTestUser(): Promise<{ userId: string; token: string }> {
    info("Setting up test user in MongoDB...");

    // Dynamically load the User model after mongoose is already connected
    const UserModule = await import("../src/model/user.model.js");
    const User = UserModule.default;

    let user = await User.findOne({ email: TEST_EMAIL }).lean<LeanUser>();

    if (!user) {
        const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
        const created = new User({
            username: TEST_USERNAME,
            email: TEST_EMAIL,
            password: hashed,
            isTestAccount: true,
            plan: "max",
            credits: {
                generation: 9999,
                editing: 9999,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
        });
        await created.save();
        user = created.toObject() as LeanUser;
        info(`Created test user: ${TEST_EMAIL}`);
    } else {
        info(`Found existing test user: ${TEST_EMAIL}`);
    }

    const userId = user._id.toString();

    const token = jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: "1h", algorithm: "HS256" }
    );

    return { userId, token };
}

// ─── Create smoke-test project ────────────────────────────────────────────────

async function setupTestProject(userId: string): Promise<string> {
    const ProjectModule = await import("../src/model/project.model.js");
    const Project = ProjectModule.default;

    const proj = new Project({
        name: "Smoke Test Project",
        status: "draft",
        bytes: 0,
    });
    await proj.save();

    const UserModule = await import("../src/model/user.model.js");
    const User = UserModule.default;
    await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $addToSet: { projects: proj._id } }
    );

    info(`Created smoke-test project: ${(proj._id as mongoose.Types.ObjectId).toString()}`);
    return (proj._id as mongoose.Types.ObjectId).toString();
}

// ─── Generation flow ──────────────────────────────────────────────────────────

interface ChatEvent {
    type: string;
    phase?: string;
    data?: unknown;
    ts?: string;
    deltaMs?: number;
}

async function runGenerationFlow(token: string, projectId: string): Promise<boolean> {
    info(`Sending generation request to ${API_BASE}${API_PREFIX}/generatechat ...`);

    const prompt = "Animate a circle changing color from red to blue.";

    // 1. POST to generate endpoint
    let chatId: string;
    let jobId: string;
    try {
        const res = await axios.post(
            `${API_BASE}${API_PREFIX}/generatechat`,
            { projectId, prompt },
            {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10_000,
            }
        );
        if (res.status !== 202) {
            fail(`Expected 202 from POST /generatechat, got ${res.status}`);
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        chatId = res.data.data.chatId as string;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        jobId = res.data.data.jobId as string;
    } catch (err) {
        fail(
            `POST ${API_BASE}${API_PREFIX}/generatechat failed: ${String(err)}. ` +
            "Is the API server running? Start it with: npm run dev"
        );
        return false;
    }

    pass(`Generation request accepted — chatId=${chatId} jobId=${jobId}`);
    const timeline: ChatEvent[] = [];
    const genStartedAt = Date.now();

    // 2. Connect Socket.IO with JWT in auth handshake
    info(`Connecting Socket.IO to ${API_BASE} (auth via JWT)...`);

    return new Promise<boolean>((resolve) => {
        let resolved = false;

        const socket: Socket = SocketIOClient(API_BASE, {
            auth: { token },
            transports: ["websocket"],
            reconnectionAttempts: 3,
            timeout: 5000,
        });

        const timeoutHandle = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            fail(
                `Timed out after ${TIMEOUT_SEC}s waiting for job_complete. ` +
                "Events received so far:"
            );
            for (const ev of timeline) {
                console.log(
                    `  [smoke]   ${ev.type.padEnd(26)} phase=${ev.phase ?? "—"} ` +
                    `delta=${ev.deltaMs ?? 0}ms`
                );
            }
            socket.disconnect();
            resolve(false);
        }, TIMEOUT_SEC * 1000);

        socket.on("connect", () => {
            pass(`Socket.IO connected (id=${socket.id})`);
            info(`Joining room: ${chatId}`);
            socket.emit("join_chat", chatId);
        });

        socket.on("connect_error", (err: Error) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutHandle);
            fail(
                `Socket.IO connection failed: ${err.message}. ` +
                "Ensure the API is running and ALLOWED_ORIGINS includes the smoke client."
            );
            socket.disconnect();
            resolve(false);
        });

        socket.on("chat_update", (event: unknown) => {
            const ev = event as { type?: string; phase?: string; data?: unknown; ts?: string };
            const deltaMs = Date.now() - genStartedAt;
            const recorded: ChatEvent = {
                type:    ev.type    ?? "unknown",
                phase:   ev.phase   ?? undefined,
                data:    ev.data    ?? undefined,
                ts:      ev.ts      ?? undefined,
                deltaMs,
            };
            timeline.push(recorded);
            info(`  chat_update  type=${recorded.type.padEnd(22)} phase=${String(recorded.phase ?? "—").padEnd(14)} ${elapsed()}`);

            if (recorded.type === "job_complete") {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutHandle);

                // Assert finalUrl looks like a Cloudinary URL
                const data = ev.data as { finalUrl?: string } | undefined;
                const finalUrl = data?.finalUrl ?? "";

                if (!finalUrl) {
                    fail("job_complete event is missing finalUrl in data payload.");
                    socket.disconnect();
                    resolve(false);
                    return;
                }

                const isCloudinaryUrl =
                    finalUrl.includes("cloudinary.com") ||
                    finalUrl.includes("res.cloudinary.com");

                if (!isCloudinaryUrl) {
                    fail(
                        `finalUrl does not look like a Cloudinary URL: ${finalUrl}`
                    );
                    socket.disconnect();
                    resolve(false);
                    return;
                }

                pass(`job_complete received — finalUrl=${finalUrl}`);
                console.log("\n[smoke] Event timeline:");
                for (const e of timeline) {
                    const dataSummary =
                        e.type === "job_complete"
                            ? "(finalUrl present)"
                            : e.data !== undefined
                            ? JSON.stringify(e.data).slice(0, 60)
                            : "";
                    console.log(
                        `  ${String(e.deltaMs).padStart(6)}ms  ${e.type.padEnd(26)} ${dataSummary}`
                    );
                }

                socket.disconnect();
                resolve(true);
            }

            if (recorded.type === "job_failed") {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutHandle);
                fail(`job_failed event received: ${JSON.stringify(ev.data)}`);
                socket.disconnect();
                resolve(false);
            }
        });

        socket.on("disconnect", (reason: string) => {
            if (!resolved) {
                info(`Socket.IO disconnected: ${reason}`);
            }
        });
    });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
    info("Cleaning up connections...");
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            info("MongoDB connection closed.");
        }
    } catch (err) {
        info(`MongoDB close error (non-fatal): ${String(err)}`);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log("\n[smoke] ======================================");
    console.log("[smoke] Stitcher backend smoke test");
    console.log(`[smoke] API base : ${API_BASE}`);
    console.log(`[smoke] Mode     : ${MOCK_MODE ? "mock (pre-flight only)" : "live"}`);
    console.log(`[smoke] Timeout  : ${TIMEOUT_SEC}s`);
    console.log("[smoke] ======================================\n");

    const preflightPassed = await runPreflightChecks();

    if (!preflightPassed) {
        await cleanup();
        process.exit(1);
    }

    if (MOCK_MODE) {
        console.log(
            "\n[smoke] Pre-flight green; skipping live generation (--mock).\n"
        );
        await cleanup();
        process.exit(0);
    }

    // ── Live generation test ────────────────────────────────────────────────
    let passed = false;
    try {
        const { userId, token } = await setupTestUser();
        const projectId = await setupTestProject(userId);
        passed = await runGenerationFlow(token, projectId);
    } catch (err) {
        fail(`Unexpected error during live generation test: ${String(err)}`);
        if (err instanceof Error && err.stack) {
            console.log(err.stack);
        }
        passed = false;
    } finally {
        await cleanup();
    }

    console.log("\n[smoke] ======================================");
    if (passed) {
        console.log("[smoke] RESULT: PASS");
    } else {
        console.log("[smoke] RESULT: FAIL");
    }
    console.log(`[smoke] Total elapsed: ${elapsed()}`);
    console.log("[smoke] ======================================\n");

    process.exit(passed ? 0 : 1);
}

main().catch((err: unknown) => {
    fail(`Unhandled error in smoke test: ${String(err)}`);
    process.exit(1);
});
