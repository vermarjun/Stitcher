/**
 * renderClient.test.ts
 *
 * Uses nock to intercept HTTP calls to RENDER_SERVICE_URL (http://localhost:8000).
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import nock from "nock";
import { renderClient, ServiceError } from "../renderClient";
import type { RenderInput } from "../renderClient";

const BASE = "http://localhost:8000";

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

const MIN_INPUT: RenderInput = {
    code: "class TestScene(Scene): pass",
    sceneClass: "TestScene",
    storage: { backend: "cloudinary", folder: "stitcher/test" },
    meta: { traceId: "render-trace-001" },
};

const SUCCESS_BODY = {
    success: true as const,
    render: {
        url: "https://res.cloudinary.com/demo/video/upload/test.mp4",
        format: "mp4" as const,
        durationSec: 5.2,
        width: 1920,
        height: 1080,
        fps: 60,
        bytes: 1_048_576,
        hasAudio: false,
    },
    execution: {
        sandboxSetupMs: 200,
        renderMs: 3000,
        uploadMs: 400,
        totalMs: 3600,
        sandbox: "docker",
    },
    meta: {},
};

const FAILURE_BODY = {
    success: false as const,
    error: {
        phase: "render",
        category: "import_error",
        summary: "ImportError: No module named manim",
        stderr: "Traceback ...",
        stdout: "",
    },
    echo: {
        code: "class TestScene(Scene): pass",
        sceneClass: "TestScene",
    },
    execution: {
        sandboxSetupMs: 100,
        renderMs: 50,
        uploadMs: 0,
        totalMs: 150,
        sandbox: "docker",
    },
    meta: {},
};

// ─── /render happy paths ──────────────────────────────────────────────────────

describe("renderClient.render", () => {
    it("happy path: 200 success=true resolves with success body", async () => {
        nock(BASE).post("/render").reply(200, SUCCESS_BODY);

        const result = await renderClient.render(MIN_INPUT);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.render.url).toContain("cloudinary.com");
            expect(result.render.fps).toBe(60);
        }
    });

    it("200 success=false does NOT throw — returns failure body", async () => {
        nock(BASE).post("/render").reply(200, FAILURE_BODY);

        // Must resolve, not reject
        const result = await renderClient.render(MIN_INPUT);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.phase).toBe("render");
            expect(result.error.category).toBe("import_error");
        }
    });

    it("discriminated union: success=true has render field", async () => {
        nock(BASE).post("/render").reply(200, SUCCESS_BODY);

        const result = await renderClient.render(MIN_INPUT);
        if (result.success) {
            // TypeScript should narrow render to RenderOutputPayload
            expect(result.render).toBeDefined();
            expect(result.error).toBeUndefined();
        }
    });

    it("discriminated union: success=false has error field", async () => {
        nock(BASE).post("/render").reply(200, FAILURE_BODY);

        const result = await renderClient.render(MIN_INPUT);
        if (!result.success) {
            expect(result.error).toBeDefined();
            expect(result.render).toBeUndefined();
        }
    });

    // ─── Transport errors ──────────────────────────────────────────────────────

    it("503 throws ServiceError with retryAfter from Retry-After header", async () => {
        nock(BASE)
            .post("/render")
            .reply(503, { error: "semaphore saturated" }, { "retry-after": "5" });

        const err = await renderClient.render(MIN_INPUT).catch((e) => e as ServiceError);

        expect(err).toBeInstanceOf(ServiceError);
        expect(err.status).toBe(503);
        expect(err.retryAfter).toBe(5);
    });

    it("500 throws ServiceError with status 500", async () => {
        nock(BASE).post("/render").reply(500, { error: "internal crash" });

        const err = await renderClient.render(MIN_INPUT).catch((e) => e as ServiceError);

        expect(err).toBeInstanceOf(ServiceError);
        expect(err.status).toBe(500);
    });

    it("network/connection error throws ServiceError with status 0", async () => {
        // nock intercepts; simulate connection refused
        nock(BASE).post("/render").replyWithError("connect ECONNREFUSED");

        const err = await renderClient.render(MIN_INPUT).catch((e) => e as ServiceError);

        expect(err).toBeInstanceOf(ServiceError);
        expect(err.status).toBe(0);
    });

    it("sends X-Trace-Id header", async () => {
        const scope = nock(BASE)
            .post("/render")
            .matchHeader("x-trace-id", "render-trace-001")
            .reply(200, SUCCESS_BODY);

        await renderClient.render(MIN_INPUT);
        expect(scope.isDone()).toBe(true);
    });

    it("sends X-Api-Key header", async () => {
        const scope = nock(BASE)
            .post("/render")
            .matchHeader("x-api-key", "test_render_api_key_stub_xx")
            .reply(200, SUCCESS_BODY);

        await renderClient.render(MIN_INPUT);
        expect(scope.isDone()).toBe(true);
    });
});
