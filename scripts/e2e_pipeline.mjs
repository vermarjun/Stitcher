/**
 * Stitcher E2E Pipeline Test Harness  (Phase 5 — OBSERVABILITY_PLAN.md §3.5)
 * ============================================================================
 * Fires a configurable set of Manim generation prompts against a running
 * Stitcher API, polls each job to completion, then prints a per-stage latency
 * + token + success report.
 *
 * HOW TO RUN
 * ----------
 *   node scripts/e2e_pipeline.mjs
 *
 * CONFIGURATION (env vars or edit DEFAULT_* constants below)
 * ----------------------------------------------------------
 *   API_BASE          Base URL of the API  (default: http://localhost:3000/api)
 *   JWT_SECRET        Unified JWT secret   (default: read from API/.env.docker)
 *   ADMIN_USER_ID     MongoDB _id of admin user (skips DB lookup if set)
 *   ADMIN_EMAIL       Admin user email     (default: vermarjun.work@gmail.com)
 *   ADMIN_PASSWORD    Admin password (used for login fallback when no MONGO)
 *   MONGO_URL         Override MongoDB URL (default: docker exec → API/.env.docker)
 *   POLL_INTERVAL_MS  Polling interval in ms   (default: 3000)
 *   JOB_TIMEOUT_MS    Per-job timeout in ms    (default: 180000)
 *
 * REQUIREMENTS
 * ------------
 *   • stitcher-api-1 container must be running (docker compose up api).
 *   • Admin user (ADMIN_EMAIL) must exist with role 'admin'.
 *   • ADMIN_DASHBOARD_ENABLED=true in the api container (Phase 0.1).
 *   • stages[] data requires the rebuilt API that writes stage rows (Phases 2+3).
 *     The harness is resilient to empty stages[] — it warns rather than crashes.
 *   • mongodb npm package is optional (looked up from API/node_modules).
 *     If unavailable, user lookup falls back to API login endpoint.
 *
 * EXIT CODE
 *   0   all jobs completed + no assertion failures
 *   1   one or more assertion failures (stages empty on a complete job, etc.)
 *  >1   fatal setup error (can't auth, can't reach API, etc.)
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createHmac } from "crypto";
import { createRequire } from "module";

// ─── Paths ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_DOCKER = path.join(REPO_ROOT, "API", ".env.docker");
// Use API/node_modules for mongodb (it's installed there)
const apiRequire = createRequire(path.join(REPO_ROOT, "API", "package.json"));

// ─── Parse .env file ─────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
    if (!existsSync(filePath)) return {};
    const out = {};
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (!val.startsWith('"') && !val.startsWith("'")) {
            const ci = val.indexOf(" #");
            if (ci !== -1) val = val.slice(0, ci).trim();
        } else {
            val = val.replace(/^["']|["']$/g, "");
        }
        out[key] = val;
    }
    return out;
}

const dotenv = parseEnvFile(ENV_DOCKER);

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE = process.env.API_BASE ?? `http://localhost:${dotenv.PORT ?? 3000}${dotenv.API_PREFIX ?? "/api"}`;
const JWT_SECRET = process.env.JWT_SECRET ?? dotenv.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "vermarjun.work@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? null;
const ADMIN_USER_ID_OVERRIDE = process.env.ADMIN_USER_ID ?? null;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 3000);
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 180_000);

// ─── Prompt set ───────────────────────────────────────────────────────────────
// Four prompts exercising: trivial text, multi-scene, plugin (neural net), stress.
const DEFAULT_PROMPTS = [
    {
        label: "trivial_text",
        prompt: "Display the text 'Hello, World!' in the center of the screen with a fade-in animation.",
    },
    {
        label: "multi_scene",
        prompt:
            "Create a 3-scene animation: (1) show a blue circle growing from the center, " +
            "(2) show the Pythagorean theorem a² + b² = c² with labeled sides on a right triangle, " +
            "(3) show the text 'QED' fading in.",
    },
    {
        label: "plugin_neural_network",
        prompt:
            "Animate a simple feedforward neural network with 3 input nodes, 4 hidden nodes, and 2 output nodes. " +
            "Show the signal flowing forward with glowing connections.",
    },
    {
        label: "stress_fourier",
        prompt:
            "Animate the Fourier series decomposition of a square wave using the first 5 harmonics. " +
            "Show each sine wave being added one at a time, then show the resulting approximation.",
    },
];

// ─── Terminal colouring ───────────────────────────────────────────────────────
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const mag = (s) => `\x1b[35m${s}\x1b[0m`;

function hr(char = "─", w = 80) { return char.repeat(w); }

function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ""); }
function padEnd(s, n) { return s + " ".repeat(Math.max(0, n - stripAnsi(s).length)); }

function fmtMs(ms) {
    if (ms == null) return dim("—");
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fmtTok(t) {
    if (!t) return dim("—");
    const tot = t.total ?? (t.input ?? 0) + (t.output ?? 0);
    return `${t.input ?? "?"}↑ ${t.output ?? "?"}↓ (${tot})`;
}
function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function apiFetch(path, { method = "GET", body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    let json;
    try { json = await res.json(); } catch { json = {}; }
    return { status: res.status, ok: res.ok, json };
}

// ─── JWT mint (HS256, Node crypto) ───────────────────────────────────────────
function buildJwt(userId, secret) {
    const hdr = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const pay = Buffer.from(JSON.stringify({
        userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
    })).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${hdr}.${pay}`).digest("base64url");
    return `${hdr}.${pay}.${sig}`;
}

// ─── MongoDB (optional, loaded from API/node_modules) ────────────────────────
let _mongoClient = null;
let _mongoDb = null;

async function getMongoUrl() {
    if (process.env.MONGO_URL) return process.env.MONGO_URL;
    try {
        const { execSync } = await import("child_process");
        const url = execSync("docker exec stitcher-api-1 printenv MONGODB_URL 2>/dev/null", { timeout: 5000 })
            .toString().trim();
        if (url.startsWith("mongodb")) return url;
    } catch { /* container not running */ }
    return dotenv.MONGODB_URL ?? null;
}

async function ensureMongo() {
    if (_mongoDb) return _mongoDb;
    const mongoUrl = await getMongoUrl();
    if (!mongoUrl) { console.warn(yellow("⚠  No MongoDB URL — skipping direct DB path")); return null; }
    try {
        const { MongoClient } = apiRequire("mongodb");
        _mongoClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 6000 });
        await _mongoClient.connect();
        const dbName = mongoUrl.split("/").pop()?.split("?")[0] ?? "Stitcher";
        _mongoDb = _mongoClient.db(dbName);
        return _mongoDb;
    } catch (err) {
        console.warn(yellow(`⚠  MongoDB connect failed (${err.message}) — falling back to API endpoints`));
        return null;
    }
}

async function closeMongo() {
    if (_mongoClient) { try { await _mongoClient.close(); } catch { /* ignore */ } }
}

// ─── Resolve admin userId ─────────────────────────────────────────────────────
async function resolveAdminUserId() {
    // 0. Hard override via env var
    if (ADMIN_USER_ID_OVERRIDE) {
        console.log(dim(`  Using ADMIN_USER_ID override: ${ADMIN_USER_ID_OVERRIDE}`));
        return ADMIN_USER_ID_OVERRIDE;
    }

    // 1. Direct MongoDB lookup
    const db = await ensureMongo();
    if (db) {
        const { ObjectId } = apiRequire("mongodb");
        const user = await db.collection("users").findOne(
            { email: ADMIN_EMAIL, role: "admin" },
            { projection: { _id: 1 } }
        );
        if (user) {
            console.log(dim(`  Admin userId (mongo): ${user._id}`));
            return user._id.toString();
        }
        // Fallback: any admin
        const anyAdmin = await db.collection("users").findOne(
            { role: "admin" }, { projection: { _id: 1, email: 1 } }
        );
        if (anyAdmin) {
            console.log(dim(`  Admin userId (fallback admin, email=${anyAdmin.email}): ${anyAdmin._id}`));
            return anyAdmin._id.toString();
        }
    }

    // 2. Login via API
    if (ADMIN_PASSWORD) {
        console.log(dim("  MongoDB unavailable — trying login endpoint…"));
        const r = await apiFetch("/user/login", {
            method: "POST",
            body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        if (r.ok) {
            const uid = r.json?.data?.userId ?? r.json?.userId ?? r.json?.data?._id ?? r.json?._id;
            if (uid) { console.log(dim(`  Admin userId (login): ${uid}`)); return uid; }
        }
        throw new Error(`Login failed: HTTP ${r.status} — ${JSON.stringify(r.json)}`);
    }

    throw new Error(
        `Could not resolve admin userId.\n` +
        `  Options:\n` +
        `    1. Set ADMIN_USER_ID=<mongo_id> env var\n` +
        `    2. Set ADMIN_PASSWORD=<pass> and let the harness log in\n` +
        `    3. Ensure stitcher-api-1 container is running (mongo client will auto-connect)`
    );
}

// ─── Ensure test project exists ───────────────────────────────────────────────
async function ensureProject(token, userId) {
    // Try to reuse an existing project via mongo
    const db = await ensureMongo();
    if (db) {
        try {
            const { ObjectId } = apiRequire("mongodb");
            const oid = ObjectId.createFromHexString(userId);
            const user = await db.collection("users").findOne(
                { _id: oid }, { projection: { projects: 1 } }
            );
            if (user?.projects?.length) {
                const pid = user.projects[0].toString();
                console.log(dim(`  Reusing existing project: ${pid}`));
                return pid;
            }
        } catch { /* ObjectId parse error or missing field — fall through */ }
    }

    // Create via API
    console.log(dim("  Creating e2e-harness project via API…"));
    const r = await apiFetch("/project", { method: "POST", token, body: { name: "e2e-harness" } });
    if (!r.ok) throw new Error(`Project create failed: HTTP ${r.status} — ${JSON.stringify(r.json)}`);
    const pid = r.json?.data?._id ?? r.json?.project?._id ?? r.json?._id;
    if (!pid) throw new Error(`Project creation response missing _id: ${JSON.stringify(r.json)}`);
    console.log(dim(`  Created project: ${pid}`));
    return pid;
}

// ─── Submit generation ────────────────────────────────────────────────────────
async function submitGeneration(token, projectId, prompt) {
    const r = await apiFetch("/generatechat", {
        method: "POST", token,
        body: { projectId, prompt },
    });
    if (!r.ok) throw new Error(`Submit failed: HTTP ${r.status} — ${JSON.stringify(r.json)}`);
    const { chatId, jobId } = r.json?.data ?? {};
    if (!chatId) throw new Error(`Submit missing chatId: ${JSON.stringify(r.json)}`);
    return { chatId, jobId };
}

// ─── Poll status ──────────────────────────────────────────────────────────────
const TERMINAL = new Set(["complete", "failed", "cancelled"]);

async function pollUntilDone(token, chatId, label) {
    const deadline = Date.now() + JOB_TIMEOUT_MS;
    let dots = 0;
    while (Date.now() < deadline) {
        try {
            const r = await apiFetch(`/generatechat/${chatId}/status`, { token });
            if (r.ok) {
                const d = r.json?.data ?? {};
                if (TERMINAL.has(d.status)) { process.stdout.write("\n"); return d; }
                process.stdout.write(`\r  ${label}: ${d.status ?? "polling"}${".".repeat((dots++ % 3) + 1)}   `);
            }
        } catch { /* network blip — retry */ }
        await sleep(POLL_INTERVAL_MS);
    }
    process.stdout.write("\n");
    return { status: "timeout", finalUrl: null, jobId: null };
}

// ─── Fetch full GenerationJob doc ─────────────────────────────────────────────
async function fetchJobDetail(adminToken, bullJobId) {
    if (!bullJobId) return null;
    // Admin endpoint
    const r = await apiFetch(`/admin/metrics/generations/${bullJobId}`, { token: adminToken });
    if (r.ok) return r.json;
    // Direct mongo fallback
    const db = await ensureMongo();
    if (db) {
        return db.collection("generationjobs").findOne({ jobId: bullJobId });
    }
    return null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function percentile(sorted, p) {
    if (!sorted.length) return null;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ─── Report: single job ───────────────────────────────────────────────────────
function printJobReport(entry) {
    const { label, chatId, bullJobId, pollResult, jobDoc, wallMs } = entry;
    const status = pollResult?.status ?? "unknown";
    const isOk = status === "complete";
    const statusStr = isOk ? green("complete") : (status === "failed" ? red("failed") : yellow(status));

    console.log();
    console.log(bold(`┌─ ${label}`));
    console.log(`│  status   : ${statusStr}`);
    console.log(`│  chatId   : ${dim(chatId ?? "—")}`);
    console.log(`│  jobId    : ${dim(bullJobId ?? "—")}`);
    console.log(`│  wall     : ${fmtMs(wallMs)}`);
    console.log(`│  finalUrl : ${pollResult?.finalUrl ? cyan(pollResult.finalUrl) : dim("—")}`);

    if (jobDoc) {
        const tok = jobDoc.tokens;
        const cost = jobDoc.costUsd;
        console.log(`│  tokens   : ${tok ? fmtTok(tok) : dim("— (not yet populated — rebuild API with Phases 2+3)")}`);
        console.log(`│  costUsd  : ${cost != null ? mag(`$${cost.toFixed(6)}`) : dim("—")}`);
    }

    const stages = jobDoc?.stages ?? [];
    if (stages.length === 0) {
        const stageWarn = isOk
            ? yellow("⚠  empty on a COMPLETE job — instrumentation not yet flowing (needs rebuilt API)")
            : dim("empty (expected before Phases 2+3)");
        console.log(`│  stages   : ${stageWarn}`);
    } else {
        console.log(`│  stages   :`);
        const COL = [20, 16, 10, 24, 8, 32];
        const hdr = ["stage[idx]", "service", "dur", "tokens", "status", "outputSummary"].map(
            (h, i) => padEnd(bold(h), COL[i])
        ).join("  ");
        console.log(`│    ${hdr}`);
        console.log(`│    ${hr("─", 114)}`);
        for (const s of stages) {
            const tag = s.sceneIndex != null ? `${s.stage}[${s.sceneIndex}]` : s.stage;
            const row = [
                tag,
                s.service ?? "—",
                fmtMs(s.durationMs),
                fmtTok(s.tokens),
                s.status === "ok" ? green("ok") : red("failed"),
                (s.outputSummary ?? "").slice(0, 50) || dim("—"),
            ].map((v, i) => padEnd(v, COL[i])).join("  ");
            console.log(`│    ${row}`);
        }
    }

    // Failure dump
    if (["failed", "timeout", "submit_error"].includes(status)) {
        console.log(`│`);
        console.log(`│  ${red(bold("FAILURE DETAIL"))}`);
        if (status === "timeout") {
            console.log(`│  Timed out after ${JOB_TIMEOUT_MS / 1000}s — pipeline still running or hung.`);
        }
        if (jobDoc?.error) {
            console.log(`│  top-level error : ${red(jobDoc.error)}`);
        }
        const failedStage = stages.find((s) => s.status === "failed");
        if (failedStage) {
            console.log(`│  failed stage    : ${failedStage.stage}` +
                (failedStage.sceneIndex != null ? `[${failedStage.sceneIndex}]` : ""));
            if (failedStage.error) {
                console.log(`│  error :`);
                for (const l of failedStage.error.split("\n").slice(0, 25)) {
                    console.log(`│    ${red(l)}`);
                }
            }
            if (failedStage.failedCode) {
                console.log(`│  failedCode (first 40 lines) :`);
                const lines = failedStage.failedCode.split("\n");
                for (const l of lines.slice(0, 40)) console.log(`│    ${dim(l)}`);
                if (lines.length > 40) console.log(`│    ${dim("… (truncated)")}`);
            }
        }
    }

    console.log(`└${"─".repeat(79)}`);
}

// ─── Report: aggregate ────────────────────────────────────────────────────────
function printAggregateReport(entries) {
    console.log();
    console.log(bold(hr("═")));
    console.log(bold("  AGGREGATE SUMMARY"));
    console.log(bold(hr("═")));

    const total = entries.length;
    const complete = entries.filter((e) => e.pollResult?.status === "complete").length;
    const failed = entries.filter((e) => e.pollResult?.status === "failed").length;
    const timeout = entries.filter((e) => e.pollResult?.status === "timeout").length;

    console.log(`  Jobs     : ${total}   Complete: ${green(complete)} (${pct(complete, total)})   ` +
        `Failed: ${failed > 0 ? red(failed) : dim(failed)} (${pct(failed, total)})   ` +
        `Timeout: ${timeout > 0 ? yellow(timeout) : dim(timeout)}`);

    const walls = entries.map((e) => e.wallMs).filter(Boolean).sort((a, b) => a - b);
    if (walls.length) {
        console.log(`  Wall p50/p95 : ${fmtMs(percentile(walls, 50))} / ${fmtMs(percentile(walls, 95))}`);
    }

    let totalIn = 0, totalOut = 0;
    for (const e of entries) {
        totalIn += e.jobDoc?.tokens?.input ?? 0;
        totalOut += e.jobDoc?.tokens?.output ?? 0;
    }
    if (totalIn + totalOut > 0) {
        const cost = entries.reduce((s, e) => s + (e.jobDoc?.costUsd ?? 0), 0);
        console.log(`  Tokens : ${totalIn}↑  ${totalOut}↓  (${totalIn + totalOut} total)` +
            (cost > 0 ? `   cost: $${cost.toFixed(6)}` : ""));
    } else {
        console.log(`  Tokens : ${dim("— not populated (needs rebuilt API with Phases 2+3)")}`);
    }

    // Per-stage p50/p95
    const byStage = {};
    for (const e of entries) {
        for (const s of e.jobDoc?.stages ?? []) {
            if (!byStage[s.stage]) byStage[s.stage] = { durs: [], tokens: 0, ok: 0, total: 0 };
            byStage[s.stage].total++;
            if (s.durationMs != null) byStage[s.stage].durs.push(s.durationMs);
            if (s.status === "ok") byStage[s.stage].ok++;
            if (s.tokens) byStage[s.stage].tokens += s.tokens.total ?? (s.tokens.input ?? 0) + (s.tokens.output ?? 0);
        }
    }

    const stageKeys = Object.keys(byStage);
    if (stageKeys.length) {
        console.log();
        console.log(bold("  PER-STAGE LATENCY"));
        const C = [20, 10, 10, 10, 10];
        const hdr = ["stage", "p50", "p95", "tokens", "success%"].map((h, i) => padEnd(bold(h), C[i])).join("  ");
        console.log(`  ${hdr}`);
        console.log(`  ${hr("─", 66)}`);
        for (const key of stageKeys) {
            const a = byStage[key];
            const sorted = [...a.durs].sort((x, y) => x - y);
            const sr = `${Math.round((a.ok / a.total) * 100)}%`;
            const row = [
                key,
                fmtMs(percentile(sorted, 50)),
                fmtMs(percentile(sorted, 95)),
                a.tokens > 0 ? String(a.tokens) : dim("—"),
                a.ok === a.total ? green(sr) : red(sr),
            ].map((v, i) => padEnd(v, C[i])).join("  ");
            console.log(`  ${row}`);
        }
    } else {
        console.log();
        console.log(yellow("  ⚠  No stage rows collected."));
        console.log(yellow("     Expected before rebuilding the API with Phases 2+3 instrumentation."));
        console.log(yellow("     Re-run this harness after the containers are rebuilt."));
    }
}

// ─── Assertions ───────────────────────────────────────────────────────────────
function runAssertions(entries) {
    const failures = [];
    for (const e of entries) {
        const { label, pollResult, jobDoc } = e;
        if (pollResult?.status !== "complete") continue;
        if (jobDoc && (!jobDoc.stages || jobDoc.stages.length === 0)) {
            failures.push(`[${label}] job complete but stages[] is empty — Phase 3 instrumentation not flowing`);
        }
        if (!pollResult?.finalUrl && !jobDoc?.finalUrl) {
            failures.push(`[${label}] job complete but has no finalUrl`);
        }
        if (jobDoc?.stages?.length) {
            const agentStages = jobDoc.stages.filter((s) =>
                ["agent_plan", "agent_code", "agent_debug"].includes(s.stage) && s.status === "ok"
            );
            const tokenless = agentStages.filter(
                (s) => !s.tokens || ((s.tokens.input ?? 0) + (s.tokens.output ?? 0) === 0)
            );
            if (tokenless.length) {
                failures.push(`[${label}] ${tokenless.length} agent stage(s) have zero tokens — Phase 2 not instrumented`);
            }
        }
    }
    return failures;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(bold(hr("═")));
    console.log(bold("  STITCHER E2E PIPELINE HARNESS  —  Phase 5"));
    console.log(bold(hr("═")));
    console.log(`  API base    : ${BASE}`);
    console.log(`  Prompts     : ${DEFAULT_PROMPTS.length}`);
    console.log(`  Timeout     : ${JOB_TIMEOUT_MS / 1000}s per job`);
    console.log(`  Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log(dim(`  JWT secret  : ${JWT_SECRET ? JWT_SECRET.slice(0, 8) + "…" : red("MISSING")}`));
    console.log();

    if (!JWT_SECRET) {
        console.error(red("FATAL: JWT_SECRET not found. Set JWT_SECRET env var or ensure API/.env.docker exists."));
        process.exit(2);
    }

    // 1. Resolve admin userId
    console.log(bold("1/5  Resolving admin user…"));
    let adminUserId;
    try {
        adminUserId = await resolveAdminUserId();
    } catch (err) {
        console.error(red(`FATAL: ${err.message}`));
        await closeMongo();
        process.exit(2);
    }

    // 2. Mint JWT
    console.log(bold("2/5  Minting admin JWT…"));
    const adminToken = buildJwt(adminUserId, JWT_SECRET);
    console.log(dim("  JWT minted (HS256)"));

    // 3. Verify API reachable + admin gate
    try {
        const ping = await apiFetch("/admin/metrics/overview", { token: adminToken });
        if (ping.status === 401 || ping.status === 403) {
            console.error(red(`FATAL: Admin auth rejected (HTTP ${ping.status}). ` +
                `Check ADMIN_DASHBOARD_ENABLED=true and that userId=${adminUserId} has role='admin'.`));
            await closeMongo();
            process.exit(2);
        }
        if (!ping.ok) {
            console.warn(yellow(`⚠  Admin overview returned HTTP ${ping.status} — proceeding anyway.`));
        } else {
            console.log(dim("  API reachable, admin auth OK"));
        }
    } catch (err) {
        console.error(red(`FATAL: Cannot reach API at ${BASE}: ${err.message}`));
        await closeMongo();
        process.exit(2);
    }

    // 4. Ensure project
    console.log(bold("3/5  Ensuring test project…"));
    let projectId;
    try {
        projectId = await ensureProject(adminToken, adminUserId);
    } catch (err) {
        console.error(red(`FATAL: ${err.message}`));
        await closeMongo();
        process.exit(2);
    }

    // 5. Fire generations
    console.log(bold(`4/5  Firing ${DEFAULT_PROMPTS.length} generations sequentially…`));
    const entries = [];

    for (const { label, prompt } of DEFAULT_PROMPTS) {
        console.log();
        console.log(`${bold("→")} ${cyan(label)}`);
        console.log(dim(`  "${prompt.slice(0, 90)}${prompt.length > 90 ? "…" : ""}"`));

        const t0 = Date.now();
        let chatId = null, bullJobId = null;

        try {
            const sub = await submitGeneration(adminToken, projectId, prompt);
            chatId = sub.chatId;
            bullJobId = sub.jobId;
            console.log(dim(`  chatId=${chatId}  jobId=${bullJobId}`));
        } catch (err) {
            console.error(red(`  Submit error: ${err.message}`));
            entries.push({ label, prompt, chatId, bullJobId, pollResult: { status: "submit_error" }, jobDoc: null, wallMs: Date.now() - t0 });
            continue;
        }

        const pollResult = await pollUntilDone(adminToken, chatId, label);
        const wallMs = Date.now() - t0;

        const resolvedJobId = bullJobId ?? pollResult?.jobId;
        let jobDoc = null;
        if (resolvedJobId) {
            try { jobDoc = await fetchJobDetail(adminToken, resolvedJobId); }
            catch (err) { console.warn(yellow(`  ⚠  Could not fetch job detail: ${err.message}`)); }
        }

        entries.push({ label, prompt, chatId, bullJobId: resolvedJobId, pollResult, jobDoc, wallMs });
    }

    // 6. Print reports
    console.log();
    console.log(bold(hr("═")));
    console.log(bold("5/5  JOB REPORTS"));
    console.log(bold(hr("═")));
    for (const e of entries) printJobReport(e);
    printAggregateReport(entries);

    // 7. Assertions
    const assertFails = runAssertions(entries);
    console.log();
    if (assertFails.length) {
        console.log(bold(red("  ASSERTION FAILURES")));
        console.log(red(`  ${hr("─", 60)}`));
        for (const f of assertFails) console.log(`  ${red("✗")} ${f}`);
    } else {
        const allComplete = entries.every((e) => e.pollResult?.status === "complete");
        if (allComplete) console.log(green(bold("  ✓ All jobs completed — no assertion failures")));
    }

    console.log();
    console.log(bold(hr("═")));
    console.log(dim(`  Finished ${new Date().toISOString()}`));
    console.log(bold(hr("═")));
    console.log();

    await closeMongo();

    const hasFails = entries.some((e) =>
        ["failed", "timeout", "submit_error"].includes(e.pollResult?.status)
    );
    process.exit(assertFails.length > 0 || hasFails ? 1 : 0);
}

main().catch(async (err) => {
    console.error(red(`Unhandled error: ${err.stack ?? err.message}`));
    await closeMongo();
    process.exit(3);
});
