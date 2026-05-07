import { describe, it, expect } from "vitest";
import { ServiceError, toServiceError } from "../ServiceError";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal fake axios error with the given status and headers. */
function fakeAxiosError(
    status: number,
    data: unknown = { msg: "error" },
    headers: Record<string, string> = {}
): unknown {
    return {
        isAxiosError: true,
        message: `Request failed with status code ${status}`,
        response: {
            status,
            data,
            headers,
        },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ServiceError", () => {
    it("constructs from a 500 axios error and sets all fields", () => {
        const axiosErr = fakeAxiosError(500, { message: "internal" });
        const err = toServiceError("rag", axiosErr, "trace-abc");

        expect(err).toBeInstanceOf(ServiceError);
        expect(err.service).toBe("rag");
        expect(err.status).toBe(500);
        expect(err.body).toEqual({ message: "internal" });
        expect(err.traceId).toBe("trace-abc");
        expect(err.name).toBe("ServiceError");
    });

    it("extracts retryAfter from Retry-After header on 503", () => {
        const axiosErr = fakeAxiosError(503, { msg: "busy" }, { "retry-after": "7" });
        const err = toServiceError("render", axiosErr);

        expect(err.status).toBe(503);
        expect(err.retryAfter).toBe(7);
    });

    it("does NOT set retryAfter on non-503 errors even if header present", () => {
        const axiosErr = fakeAxiosError(429, { msg: "too many" }, { "retry-after": "60" });
        const err = toServiceError("agent", axiosErr);

        expect(err.status).toBe(429);
        expect(err.retryAfter).toBeUndefined();
    });

    it("constructs from a plain Error (non-axios) with status 0 and message as body", () => {
        const networkErr = new Error("network timeout");
        const err = toServiceError("rag", networkErr);

        expect(err.status).toBe(0);
        expect(err.body).toBe("network timeout");
        expect(err.retryAfter).toBeUndefined();
    });

    it("constructs from a non-Error non-axios value with status 0", () => {
        const err = toServiceError("agent", "some string error");

        expect(err.status).toBe(0);
        expect(err.body).toBe("some string error");
    });

    it("propagates traceId for non-axios errors", () => {
        const err = toServiceError("render", new Error("stream broke"), "tid-999");
        expect(err.traceId).toBe("tid-999");
    });

    it("message contains service name and status", () => {
        const axiosErr = fakeAxiosError(500);
        const err = toServiceError("rag", axiosErr);
        expect(err.message).toContain("rag");
        expect(err.message).toContain("500");
    });

    it("message contains retry hint when retryAfter is set", () => {
        const axiosErr = fakeAxiosError(503, {}, { "retry-after": "30" });
        const err = toServiceError("render", axiosErr);
        expect(err.message).toContain("30");
    });

    it("axios error without response body falls back to message string", () => {
        const axiosErr = {
            isAxiosError: true,
            message: "timeout of 0ms exceeded",
            response: undefined,
        };
        const err = toServiceError("rag", axiosErr);
        expect(err.status).toBe(0);
        expect(err.body).toBe("timeout of 0ms exceeded");
    });
});
