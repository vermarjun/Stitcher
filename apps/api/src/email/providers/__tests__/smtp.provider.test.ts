import { describe, it, expect } from "vitest";
import { resolveSmtpTransport } from "../smtp.provider";

describe("resolveSmtpTransport", () => {
    it("returns null for smtp without a host", () => {
        expect(resolveSmtpTransport("smtp", { from: "a" })).toBeNull();
    });

    it("uses submission port 587 (STARTTLS) by default for smtp", () => {
        expect(resolveSmtpTransport("smtp", { host: "mail.example.com", user: "u", pass: "p", from: "a" })).toEqual({
            host: "mail.example.com",
            port: 587,
            secure: false,
            auth: { user: "u", pass: "p" },
        });
    });

    it("uses TLS on 465", () => {
        expect(resolveSmtpTransport("smtp", { host: "h", port: 465, from: "a" })).toMatchObject({ secure: true });
    });

    it("gmail preset fills in the host and strips spaces from the app password", () => {
        expect(resolveSmtpTransport("gmail", { user: "me@gmail.com", pass: "abcd efgh ijkl mnop", from: "a" })).toEqual({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user: "me@gmail.com", pass: "abcdefghijklmnop" },
        });
    });
});
