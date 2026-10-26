/**
 * cache_key / normalize_text PARITY test.
 *
 * The Node implementation in ttsClient MUST produce byte-identical sha256 hex to
 * the render service's Python `stitcher_voiceover.cache_key`. If these diverge,
 * OfflineTTS cannot find the staged `<key>.mp3` and every voiceover render fails.
 *
 * The expected hex values below were generated from the REAL render venv:
 *   python -c \
 *     "from stitcher_voiceover import cache_key; print(cache_key('...'))"
 * including unicode + whitespace edge cases that exercise the Python-vs-JS
 * whitespace-set difference (U+001C..1F, U+0085 vs U+FEFF).
 */

import { describe, it, expect, vi } from "vitest";

// Importing ttsClient pulls in the Redis connection. Stub it so the test never
// opens a socket (a retrying connection logs after teardown and fails the run).
vi.mock("../../queue/connection", () => ({
    redisConnection: { status: "end" },
}));
import { cacheKey, normalizeText } from "../ttsClient";

describe("ttsClient cache_key parity with Python stitcher_voiceover", () => {
    // [ raw text, expected sha256 hex from the render venv ]
    const VECTORS: Array<[string, string]> = [
        // Known frozen vector from the contract.
        [
            "The quick brown fox",
            "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9",
        ],
        // Unicode (NFC) + leading/trailing + internal multi-space collapse.
        [
            "  Café   résumé  ",
            "d4dde0b4606354c9f5283ed44e9e3b0901c6527d5f5779af41c0631c880ad4aa",
        ],
        // Multi-line with blank line + leading spaces (newlines collapse to space).
        [
            "line one\nline two\n\n  line three",
            "8a115870185ad8163e11668ffdbb8e0348852842f654d84ed578e7ca561d6134",
        ],
        // Tab as whitespace.
        ["a\tb c", "0e9f64031fcb2bc708b531c2a20441580425d151a38503f38592a7dd36019d3b"],
        // NFD-decomposed accent must normalize to the same key as NFC "Café".
        ["Café", "73473dcc12b763085904a5279d048c4d5b3b008c46f1f32443b99de04aa83a14"],
    ];

    it.each(VECTORS)("cacheKey(%j) matches the Python reference hex", (text, expected) => {
        expect(cacheKey(text)).toBe(expected);
    });

    it("matches the contract's KNOWN VECTOR exactly", () => {
        expect(cacheKey("The quick brown fox")).toBe(
            "5cac4f980fedc3d3f1f99b4be3472c9b30d56523e632d151237ec9309048bda9"
        );
    });

    it("normalizeText collapses Python-whitespace runs and strips", () => {
        expect(normalizeText("  Café   résumé  ")).toBe("Café résumé");
        expect(normalizeText("a\tb c")).toBe("a b c");
        expect(normalizeText("line one\nline two\n\n  line three")).toBe(
            "line one line two line three"
        );
    });

    it("NFD and NFC inputs produce the same key", () => {
        expect(cacheKey("Café")).toBe(cacheKey("Café"));
    });

    it("treats Python-only whitespace (U+001F, U+0085) as separators", () => {
        // These collapse in Python str.split() but NOT in JS \s — verify our set.
        expect(normalizeText("ab")).toBe("a b");
        expect(normalizeText("ab")).toBe("a b");
    });

    it("does NOT treat U+FEFF (ZWNBSP) as whitespace (Python str.split() does not)", () => {
        // JS \s WOULD collapse this; Python does not. So it stays joined.
        expect(normalizeText("a﻿b")).toBe("a﻿b");
    });
});
