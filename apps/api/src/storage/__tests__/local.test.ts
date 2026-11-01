import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createLocalStorage } from "../local";

let root: string;
let src: string;
const BASE = "http://localhost:3000/api/media";

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stitcher-storage-test-"));
    src = path.join(root, "source.bin");
    fs.writeFileSync(src, Buffer.from("hello world"));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe("local storage", () => {
    it("putFile copies the file and returns a media URL", async () => {
        const store = createLocalStorage({ dir: path.join(root, "media"), publicBase: BASE });
        const out = await store.putFile(src, "uploads/p1/a.mp3", { contentType: "audio/mpeg" });

        expect(out.url).toBe(`${BASE}/uploads/p1/a.mp3`);
        expect(out.key).toBe("uploads/p1/a.mp3");
        expect(out.bytes).toBe(11);
        expect(out.thumbnailUrl).toBeUndefined();
        expect(fs.readFileSync(path.join(root, "media", "uploads/p1/a.mp3"), "utf8")).toBe("hello world");
        expect(fs.existsSync(src)).toBe(true); // the source is left in place
    });

    it("putBuffer writes the bytes", async () => {
        const store = createLocalStorage({ dir: path.join(root, "media"), publicBase: `${BASE}/` });
        const out = await store.putBuffer(Buffer.from("abc"), "x/y.txt");
        expect(out.url).toBe(`${BASE}/x/y.txt`); // trailing slash on the base is ignored
        expect(fs.readFileSync(path.join(root, "media", "x/y.txt"), "utf8")).toBe("abc");
    });

    it("encodes unusual characters in the URL and maps it back to the key", async () => {
        const store = createLocalStorage({ dir: path.join(root, "media"), publicBase: BASE });
        const out = await store.putBuffer(Buffer.from("1"), "a b/c#d.txt");
        expect(out.url).toBe(`${BASE}/a%20b/c%23d.txt`);
        expect(store.keyFromUrl(out.url)).toBe("a b/c#d.txt");
        expect(store.keyFromUrl(`${out.url}?download=x`)).toBe("a b/c#d.txt");
        expect(store.keyFromUrl("https://elsewhere.example/a.txt")).toBeNull();
    });

    it("rejects keys that escape the storage directory", async () => {
        const store = createLocalStorage({ dir: path.join(root, "media"), publicBase: BASE });
        await expect(store.putBuffer(Buffer.from("x"), "../evil.txt")).rejects.toThrow(/Invalid storage key/);
        await expect(store.putBuffer(Buffer.from("x"), "/abs.txt")).rejects.toThrow(/Invalid storage key/);
        await expect(store.putBuffer(Buffer.from("x"), "a/../../b.txt")).rejects.toThrow(/Invalid storage key/);
        expect(store.keyFromUrl(`${BASE}/..%2F..%2Fetc/passwd`)).toBeNull();
    });

    it("remove deletes the file and tolerates a missing one", async () => {
        const store = createLocalStorage({ dir: path.join(root, "media"), publicBase: BASE });
        await store.putBuffer(Buffer.from("x"), "k/file.txt");
        await store.remove("k/file.txt");
        expect(fs.existsSync(path.join(root, "media", "k/file.txt"))).toBe(false);
        await expect(store.remove("k/file.txt")).resolves.toBeUndefined();
    });
});
