/**
 * url.util.test.ts
 *
 * Tests assertHttpUrl, the pure URL guard (SSRF prevention).
 */

import { describe, it, expect } from "vitest";
import { assertHttpUrl } from "../url.util";
import { AppError } from "../AppError";

describe("assertHttpUrl", () => {
    it("accepts http:// URLs", () => {
        expect(() => assertHttpUrl("http://example.com/video.mp4")).not.toThrow();
    });

    it("accepts https:// URLs", () => {
        expect(() => assertHttpUrl("https://cdn.example.com/demo/video/upload/v1/test.mp4")).not.toThrow();
    });

    it("accepts http URL with path and query params", () => {
        expect(() =>
            assertHttpUrl("http://cdn.example.com/path/to/file.mp4?token=abc123")
        ).not.toThrow();
    });

    it("rejects file:// protocol", () => {
        expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(AppError);
    });

    it("rejects ftp:// protocol", () => {
        expect(() => assertHttpUrl("ftp://ftp.example.com/file.mp4")).toThrow(AppError);
    });

    it("rejects data: URL", () => {
        expect(() => assertHttpUrl("data:text/plain;base64,SGVsbG8=")).toThrow(AppError);
    });

    it("rejects malformed/empty string", () => {
        expect(() => assertHttpUrl("not a url at all")).toThrow(AppError);
    });

    it("rejects empty string", () => {
        expect(() => assertHttpUrl("")).toThrow(AppError);
    });

    it("rejects javascript: protocol", () => {
        expect(() => assertHttpUrl("javascript:alert(1)")).toThrow(AppError);
    });

    it("throws AppError (not generic Error) on rejection", () => {
        try {
            assertHttpUrl("file:///etc/passwd");
            throw new Error("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as AppError).statusCode).toBe(400);
        }
    });

    it("AppError code is unsafe_url_protocol for non-http/https schemes", () => {
        try {
            assertHttpUrl("ftp://ftp.example.com");
            throw new Error("should have thrown");
        } catch (err) {
            expect((err as AppError).code).toBe("unsafe_url_protocol");
        }
    });

    it("AppError code is invalid_url for malformed input", () => {
        try {
            assertHttpUrl(":::bad");
            throw new Error("should have thrown");
        } catch (err) {
            expect((err as AppError).code).toBe("invalid_url");
        }
    });
});
