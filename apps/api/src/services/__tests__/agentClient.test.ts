/**
 * agentClient.test.ts
 *
 * Uses nock to intercept HTTP calls to AGENT_SERVICE_URL (http://localhost:4000).
 *
 * streamEvents / parseSseStream:
 *   parseSseStream is exported from agentClient.ts (a minimal, harmless addition
 *   that makes it directly testable without fighting nock's stream API).  We feed
 *   it a Node Readable constructed from fake SSE bytes.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import nock from "nock";
import { Readable } from "stream";
import { agentClient, parseSseStream, ServiceError } from "../agentClient";
import type {
    PlanResponse,
    CodeResponse,
    DebugResponse,
    AgentEvent,
} from "../agentClient";

const BASE = "http://localhost:4000";

beforeAll(() => {
    nock.disableNetConnect();
});

afterEach(() => {
    nock.cleanAll();
});

afterAll(() => {
    nock.enableNetConnect();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STYLE_MANIFEST = {
    primaryColor: "#ffffff",
    secondaryColor: "#000000",
    backgroundColor: "#1a1a2e",
    accentColor: "#e94560",
    fontFamily: "Sans",
    animationPace: "medium" as const,
    positioningZones: {},
    elementNaming: {},
};

const SCENE_SPEC = {
    index: 0,
    prompt: "Show a sine wave",
    durationSec: 5,
    manimFeatures: ["FunctionGraph"],
    requiredSymbols: ["Axes"],
};

// ─── /plan ────────────────────────────────────────────────────────────────────

describe("agentClient.plan", () => {
    it("happy path: returns full PlanResponse with success true", async () => {
        const body: PlanResponse = {
            success: true,
            jobId: "job-plan-001",
            output: {
                scenes: [SCENE_SPEC],
                styleManifest: STYLE_MANIFEST,
            },
            error: null,
        };

        nock(BASE).post("/plan").reply(200, body);

        const result = await agentClient.plan({ prompt: "explain trig" });

        expect(result.success).toBe(true);
        expect(result.jobId).toBe("job-plan-001");
        expect(result.output?.scenes).toHaveLength(1);
    });

    it("success:false body does NOT throw — client returns domain failure", async () => {
        const body: PlanResponse = {
            success: false,
            jobId: "job-plan-002",
            output: null,
            error: { summary: "Prompt was too vague" },
        };

        nock(BASE).post("/plan").reply(200, body);

        // Must resolve, not reject
        const result = await agentClient.plan({ prompt: "..." });
        expect(result.success).toBe(false);
        expect(result.error?.summary).toBe("Prompt was too vague");
    });

    it("throws ServiceError on 500", async () => {
        nock(BASE).post("/plan").reply(500, { error: "crash" });

        await expect(
            agentClient.plan({ prompt: "test" })
        ).rejects.toBeInstanceOf(ServiceError);
    });

    it("sends X-Trace-Id when traceId is provided", async () => {
        const scope = nock(BASE)
            .post("/plan")
            .matchHeader("x-trace-id", "plan-trace-001")
            .reply(200, { success: true, jobId: "j1", output: null, error: null });

        await agentClient.plan({ prompt: "test" }, "plan-trace-001");
        expect(scope.isDone()).toBe(true);
    });
});

// ─── /code ────────────────────────────────────────────────────────────────────

// /code takes the raw prompt (single-scene flow), not a planner scene spec.
const CODE_INPUT = {
    prompt: "Show a sine wave",
    voiceover: true as const,
    styleManifest: STYLE_MANIFEST,
};

describe("agentClient.code", () => {
    it("happy path: returns CodeResponse with success true", async () => {
        const body: CodeResponse = {
            success: true,
            jobId: "job-code-001",
            output: {
                sceneIndex: 0,
                sceneClass: "SineWaveScene",
                code: "class SineWaveScene(Scene): pass",
                status: "validated",
            },
            error: null,
        };

        nock(BASE).post("/code").reply(200, body);

        const result = await agentClient.code(CODE_INPUT);

        expect(result.success).toBe(true);
        expect(result.output?.sceneClass).toBe("SineWaveScene");
    });

    it("success:false body does NOT throw", async () => {
        const body: CodeResponse = {
            success: false,
            jobId: "job-code-002",
            output: null,
            error: { summary: "Code generation failed after 3 retries" },
        };

        nock(BASE).post("/code").reply(200, body);

        const result = await agentClient.code(CODE_INPUT);
        expect(result.success).toBe(false);
    });

    it("throws ServiceError on 503", async () => {
        nock(BASE)
            .post("/code")
            .reply(503, { error: "overloaded" }, { "retry-after": "10" });

        const err = await agentClient
            .code(CODE_INPUT)
            .catch((e) => e as ServiceError);

        expect(err).toBeInstanceOf(ServiceError);
        expect(err.status).toBe(503);
        expect(err.retryAfter).toBe(10);
    });
});

// ─── /debug ───────────────────────────────────────────────────────────────────

describe("agentClient.debug", () => {
    it("happy path: returns DebugResponse with success true", async () => {
        const body: DebugResponse = {
            success: true,
            jobId: "job-debug-001",
            output: {
                sceneClass: "SineWaveScene",
                code: "class SineWaveScene(Scene): pass  # fixed",
                changeSummary: "Fixed import",
            },
            error: null,
        };

        nock(BASE).post("/debug").reply(200, body);

        const result = await agentClient.debug({
            brokenCode: "bad code",
            error: { stderr: "ImportError", summary: "Missing import" },
        });

        expect(result.success).toBe(true);
        expect(result.output?.changeSummary).toBe("Fixed import");
    });
});

// ─── /jobs/:jobId ─────────────────────────────────────────────────────────────

describe("agentClient.getJob", () => {
    it("happy path: returns job state record", async () => {
        const body = { jobId: "job-abc", state: "completed", progress: 100 };

        nock(BASE).get("/jobs/job-abc").reply(200, body);

        const result = await agentClient.getJob("job-abc");
        expect(result["jobId"]).toBe("job-abc");
        expect(result["state"]).toBe("completed");
    });

    it("throws ServiceError on 404", async () => {
        nock(BASE).get("/jobs/missing").reply(404, { error: "not found" });

        await expect(agentClient.getJob("missing")).rejects.toBeInstanceOf(ServiceError);
    });
});

// ─── /jobs/:jobId/cancel ──────────────────────────────────────────────────────

describe("agentClient.cancelJob", () => {
    it("happy path: returns { cancelled, jobId }", async () => {
        nock(BASE)
            .post("/jobs/job-xyz/cancel")
            .reply(200, { cancelled: true, jobId: "job-xyz" });

        const result = await agentClient.cancelJob("job-xyz");
        expect(result.cancelled).toBe(true);
        expect(result.jobId).toBe("job-xyz");
    });
});

// ─── parseSseStream (exported for testability) ────────────────────────────────

/**
 * parseSseStream is tested directly by feeding it a Node Readable.
 * This avoids the complexity of making nock produce a true streaming response,
 * which is notoriously unreliable for SSE/chunked transfer in nock v14.
 */
describe("parseSseStream", () => {
    function makeReadable(sseText: string): Readable {
        return Readable.from([Buffer.from(sseText, "utf8")]);
    }

    async function collect(stream: Readable): Promise<AgentEvent[]> {
        const events: AgentEvent[] = [];
        for await (const ev of parseSseStream(stream, "agent")) {
            events.push(ev);
        }
        return events;
    }

    it("parses a single event with JSON data", async () => {
        const sse = "event: scene_started\ndata: {\"sceneIndex\":0}\n\n";
        const events = await collect(makeReadable(sse));

        expect(events).toHaveLength(1);
        expect(events[0].event).toBe("scene_started");
        expect(events[0].data).toEqual({ sceneIndex: 0 });
    });

    it("parses multiple events in sequence", async () => {
        const sse = [
            "event: scene_started\ndata: {\"sceneIndex\":0}\n\n",
            "event: scene_render_complete\ndata: {\"sceneIndex\":0,\"url\":\"https://x.com/v.mp4\"}\n\n",
        ].join("");

        const events = await collect(makeReadable(sse));
        expect(events).toHaveLength(2);
        expect(events[0].event).toBe("scene_started");
        expect(events[1].event).toBe("scene_render_complete");
        expect((events[1].data as Record<string, unknown>)["url"]).toBe("https://x.com/v.mp4");
    });

    it("handles non-JSON data as raw string", async () => {
        const sse = "event: log\ndata: plain text message\n\n";
        const events = await collect(makeReadable(sse));
        expect(events[0].data).toBe("plain text message");
    });

    it("uses 'message' as default event type when event: line is absent", async () => {
        const sse = "data: {\"hello\":\"world\"}\n\n";
        const events = await collect(makeReadable(sse));
        expect(events[0].event).toBe("message");
    });

    it("parses id: field into event.id", async () => {
        const sse = "id: evt-42\nevent: ping\ndata: {}\n\n";
        const events = await collect(makeReadable(sse));
        expect(events[0].id).toBe("evt-42");
    });

    it("yields trailing event without final blank line", async () => {
        // Stream closed before trailing \\n\\n
        const sse = "event: done\ndata: {\"finished\":true}";
        const events = await collect(makeReadable(sse));
        expect(events).toHaveLength(1);
        expect(events[0].event).toBe("done");
    });

    it("returns empty array for empty stream", async () => {
        const events = await collect(makeReadable(""));
        expect(events).toHaveLength(0);
    });

    it("resets event type between events", async () => {
        const sse =
            "event: first\ndata: 1\n\n" +
            "data: 2\n\n"; // second event has no explicit event: line
        const events = await collect(makeReadable(sse));
        expect(events[0].event).toBe("first");
        expect(events[1].event).toBe("message"); // reset to default
    });
});
