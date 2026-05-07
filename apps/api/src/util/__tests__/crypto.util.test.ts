import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "../crypto.util";

const PREFIX = "enc:v1:";

describe("encrypt", () => {
    it("produces output with enc:v1: prefix", () => {
        const out = encrypt("hello");
        expect(out.startsWith(PREFIX)).toBe(true);
    });

    it("produces different ciphertexts for same plaintext (random IV)", () => {
        const c1 = encrypt("same plaintext");
        const c2 = encrypt("same plaintext");
        expect(c1).not.toBe(c2);
    });

    it("can encrypt an empty string", () => {
        const out = encrypt("");
        expect(out.startsWith(PREFIX)).toBe(true);
    });

    it("can encrypt ASCII text", () => {
        const out = encrypt("hello world 123 !@#");
        expect(out.startsWith(PREFIX)).toBe(true);
    });

    it("can encrypt UTF-8 multi-byte text", () => {
        const out = encrypt("こんにちは 🔐 مرحبا");
        expect(out.startsWith(PREFIX)).toBe(true);
    });

    it("can encrypt a long string", () => {
        const long = "x".repeat(10_000);
        const out = encrypt(long);
        expect(out.startsWith(PREFIX)).toBe(true);
    });
});

describe("decrypt", () => {
    it("round-trips ASCII plaintext", () => {
        const plain = "my secret key";
        expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it("round-trips empty string", () => {
        expect(decrypt(encrypt(""))).toBe("");
    });

    it("round-trips UTF-8 multi-byte text", () => {
        const plain = "こんにちは 🔐 مرحبا";
        expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it("round-trips a long string", () => {
        const long = "abcdef".repeat(2000);
        expect(decrypt(encrypt(long))).toBe(long);
    });

    it("lazy migration path: returns input as-is when no prefix", () => {
        const legacyPlain = "sk-live-xxxxxxxxxxxx";
        expect(decrypt(legacyPlain)).toBe(legacyPlain);
    });

    it("throws when ciphertext bytes are tampered (auth tag failure)", () => {
        const encrypted = encrypt("do not tamper");
        // Flip a character in the base64 payload after the prefix
        const payload = encrypted.slice(PREFIX.length);
        // Replace the first char with a different char
        const flipped = payload[0] === "A" ? "B" : "A";
        const tampered = PREFIX + flipped + payload.slice(1);

        expect(() => decrypt(tampered)).toThrow();
    });
});

describe("isEncrypted", () => {
    it("returns true for enc:v1: prefixed strings", () => {
        expect(isEncrypted(PREFIX + "somebase64payload")).toBe(true);
    });

    it("returns false for plain strings", () => {
        expect(isEncrypted("sk-live-xxxxxxxxxxxx")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isEncrypted("")).toBe(false);
    });

    it("returns true for output of encrypt()", () => {
        expect(isEncrypted(encrypt("test"))).toBe(true);
    });

    it("returns false for partial prefix (not quite enc:v1:)", () => {
        expect(isEncrypted("enc:v1")).toBe(false);
        expect(isEncrypted("enc:v2:somedata")).toBe(false);
    });
});
