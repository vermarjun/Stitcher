import { describe, it, expect } from "vitest";
import { escapeRegex } from "../escapeRegex.util";

const METACHARACTERS = [".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"];

describe("escapeRegex", () => {
    it("escapes each regex metacharacter individually", () => {
        for (const char of METACHARACTERS) {
            const escaped = escapeRegex(char);
            expect(escaped).toBe(`\\${char}`);
        }
    });

    it("escapes all metacharacters in a combined string", () => {
        const input = ".*+?^${}()|[\\]";
        const escaped = escapeRegex(input);
        // Should be usable in RegExp without throwing
        expect(() => new RegExp(escaped)).not.toThrow();
        // The escaped result should NOT match any special regex behavior
        const re = new RegExp(escaped);
        expect(re.test(input)).toBe(true);
    });

    it("does not escape normal alphanumeric characters", () => {
        const input = "hello123 world";
        expect(escapeRegex(input)).toBe("hello123 world");
    });

    it("caps input at 100 characters", () => {
        const long = "a".repeat(200);
        const result = escapeRegex(long);
        expect(result.length).toBe(100);
    });

    it("caps input before escaping (meta at pos 101 is dropped)", () => {
        // 100 'a' chars + '.' at position 101 — the dot should be dropped
        const input = "a".repeat(100) + ".";
        const result = escapeRegex(input);
        expect(result).toBe("a".repeat(100));
        expect(result).not.toContain("\\.");
    });

    it("result is safe as a RegExp constructor argument", () => {
        const tricky = "foo(bar).baz*";
        const escaped = escapeRegex(tricky);
        expect(() => new RegExp(escaped)).not.toThrow();

        // The RegExp should match the literal string
        const re = new RegExp(escaped);
        expect(re.test(tricky)).toBe(true);
    });

    it("empty string returns empty string", () => {
        expect(escapeRegex("")).toBe("");
    });

    it("handles a backslash correctly", () => {
        expect(escapeRegex("\\")).toBe("\\\\");
        // A double-backslash should be a valid RegExp
        expect(() => new RegExp("\\\\")).not.toThrow();
    });

    it("result of escaping a 100-char metachar-heavy string is still a valid RegExp", () => {
        const input = ".*+?^${}()|[]\\".repeat(8).slice(0, 100);
        const escaped = escapeRegex(input);
        expect(() => new RegExp(escaped)).not.toThrow();
    });
});
