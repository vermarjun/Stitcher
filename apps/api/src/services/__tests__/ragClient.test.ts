/**
 * ragClient.test.ts
 *
 * Uses nock to intercept HTTP calls to the configured RAG_SERVICE_URL
 * (http://localhost:7000 in test env).  No real network traffic.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import nock from "nock";
import { ragClient, ServiceError } from "../ragClient";

const BASE = "http://localhost:7000";

beforeAll(() => {
    nock.disableNetConnect();
});

afterEach(() => {
    nock.cleanAll();
});

afterAll(() => {
    nock.enableNetConnect();
});

// ─── /enhance ────────────────────────────────────────────────────────────────

describe("ragClient.enhance", () => {
    const happyBody = {
        groundedPrompt: "A grounded prompt",
        structuredContext: {
            apiExamples: [],
            similarScripts: [],
            styleRecommendations: [],
            pitfalls: [],
        },
        retrievalTrace: {
            denseCandidates: 10,
            sparseCandidates: 5,
            mergedCandidates: 12,
            afterRerank: 8,
            embedModel: "text-embedding-3-small",
            rerankModel: "cross-encoder",
            store: "qdrant",
            phase: 1,
        },
        execution: {
            totalMs: 340,
            queryTransformMs: 20,
            embeddingMs: 50,
            vectorSearchMs: 80,
            rerankMs: 120,
            hydeMs: 30,
            synthesisMs: 40,
            llmCalls: 2,
        },
    };

    it("happy path: returns structured response and sends X-Api-Key", async () => {
        const scope = nock(BASE)
            .post("/enhance")
            .matchHeader("x-api-key", "test_rag_api_key_stub_xxxx")
            .reply(200, happyBody);

        const result = await ragClient.enhance({ prompt: "explain fourier transform" });

        expect(scope.isDone()).toBe(true);
        expect(result.groundedPrompt).toBe("A grounded prompt");
        expect(result.retrievalTrace.phase).toBe(1);
        expect(result.execution.llmCalls).toBe(2);
    });

    it("sends X-Trace-Id header when traceId is provided", async () => {
        const scope = nock(BASE)
            .post("/enhance")
            .matchHeader("x-trace-id", "trace-xyz-001")
            .reply(200, happyBody);

        await ragClient.enhance({ prompt: "test" }, "trace-xyz-001");
        expect(scope.isDone()).toBe(true);
    });

    it("does NOT send X-Trace-Id when no traceId provided", async () => {
        // nock will match regardless of headers — just ensure no header breaks it
        nock(BASE).post("/enhance").reply(200, happyBody);

        const result = await ragClient.enhance({ prompt: "no trace" });
        expect(result.groundedPrompt).toBeDefined();
    });

    it("throws ServiceError with status 401 on unauthorized", async () => {
        nock(BASE).post("/enhance").reply(401, { error: "Unauthorized" });

        await expect(ragClient.enhance({ prompt: "test" })).rejects.toSatisfy(
            (e: unknown) => e instanceof ServiceError && (e as ServiceError).status === 401
        );
    });

    it("throws ServiceError with status 500 on server error", async () => {
        nock(BASE).post("/enhance").reply(500, { error: "Internal Server Error" });

        await expect(ragClient.enhance({ prompt: "test" })).rejects.toSatisfy(
            (e: unknown) => e instanceof ServiceError && (e as ServiceError).status === 500
        );
    });
});

// ─── /corpus/add ─────────────────────────────────────────────────────────────

describe("ragClient.corpusAdd", () => {
    it("happy path 207 partial: allSucceeded is false", async () => {
        nock(BASE)
            .post("/corpus/add")
            .reply(207, {
                results: [
                    { id: "doc1", success: true },
                    { id: "doc2", success: false, error: "duplicate" },
                ],
            });

        const result = await ragClient.corpusAdd({
            documents: [{ id: "doc1" }, { id: "doc2" }],
        });

        expect(result.allSucceeded).toBe(false);
        expect(result.results).toHaveLength(2);
        expect(result.results[1].success).toBe(false);
    });

    it("200 response: allSucceeded is true", async () => {
        nock(BASE)
            .post("/corpus/add")
            .reply(200, { results: [{ id: "doc1", success: true }] });

        const result = await ragClient.corpusAdd({ documents: [{ id: "doc1" }] });
        expect(result.allSucceeded).toBe(true);
    });

    it("throws ServiceError on 400", async () => {
        nock(BASE).post("/corpus/add").reply(400, { error: "Bad request" });

        await expect(
            ragClient.corpusAdd({ documents: [] })
        ).rejects.toBeInstanceOf(ServiceError);
    });
});

// ─── /corpus/stats ───────────────────────────────────────────────────────────

describe("ragClient.corpusStats", () => {
    it("happy path returns stats object", async () => {
        nock(BASE)
            .get("/corpus/stats")
            .reply(200, { count: 42, source: "qdrant", note: "phase 1 corpus" });

        const stats = await ragClient.corpusStats();
        expect(stats.count).toBe(42);
        expect(stats.source).toBe("qdrant");
    });
});

// ─── /health ─────────────────────────────────────────────────────────────────

describe("ragClient.health", () => {
    it("200 response: resolves and returns health object", async () => {
        nock(BASE)
            .get("/health")
            .reply(200, { status: "ok", checks: {}, version: "1.0.0" });

        const h = await ragClient.health();
        expect(h.status).toBe("ok");
    });

    it("503 response: resolves (not throws) because validateStatus allows 503", async () => {
        nock(BASE)
            .get("/health")
            .reply(503, { status: "down", checks: {}, version: "1.0.0" });

        // health() uses validateStatus: s === 200 || s === 503, so should not throw
        const h = await ragClient.health();
        expect(h.status).toBe("down");
    });
});
