import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import logger from "../util/logger.util";
import type { PutOptions, StorageBackend, StoredFile } from "./types";

export interface LocalStorageOptions {
    /** Directory that holds the files. Created on first write. */
    dir: string;
    /** URL prefix the files are served under, with no trailing slash. Example: http://localhost:3000/api/media */
    publicBase: string;
}

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

/** Reject keys that could escape the storage directory. */
export function assertSafeKey(key: string): void {
    if (!key || key.startsWith("/") || key.includes("\0") || key.split(/[\\/]/).some((p) => p === ".." || p === "")) {
        throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
    }
}

function encodeKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
}

function thumbKeyFor(key: string): string {
    return `${key.replace(/\.[^./]+$/, "")}.thumb.jpg`;
}

function makeThumbnail(src: string, dest: string): Promise<boolean> {
    return new Promise((resolve) => {
        const args = ["-y", "-loglevel", "error", "-ss", "1", "-i", src, "-frames:v", "1", "-vf", "scale=640:-2", dest];
        let proc;
        try {
            proc = spawn("ffmpeg", args, { stdio: "ignore" });
        } catch {
            return resolve(false);
        }
        proc.on("error", () => resolve(false)); // ffmpeg not installed
        proc.on("close", async (code) => {
            if (code === 0) return resolve(true);
            // Clips shorter than 1s have no frame at the 1s mark: retry from the start.
            const retry = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-frames:v", "1", "-vf", "scale=640:-2", dest], { stdio: "ignore" });
            retry.on("error", () => resolve(false));
            retry.on("close", (c2) => resolve(c2 === 0));
        });
    });
}

export function createLocalStorage(opts: LocalStorageOptions): StorageBackend {
    const root = path.resolve(opts.dir);
    const base = opts.publicBase.replace(/\/+$/, "");

    const resolveKey = (key: string): string => {
        assertSafeKey(key);
        const full = path.join(root, key);
        if (!full.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
        return full;
    };

    async function finish(dest: string, key: string, o?: PutOptions): Promise<StoredFile> {
        const stat = await fsp.stat(dest);
        const result: StoredFile = { url: `${base}/${encodeKey(key)}`, key, bytes: stat.size };
        const wantThumb = o?.thumbnail !== false;
        if (wantThumb && VIDEO_EXT.has(path.extname(key).toLowerCase())) {
            const thumbKey = thumbKeyFor(key);
            if (await makeThumbnail(dest, resolveKey(thumbKey))) {
                result.thumbnailUrl = `${base}/${encodeKey(thumbKey)}`;
            } else {
                logger.debug({ message: "[storage] no thumbnail (ffmpeg missing or failed)", key });
            }
        }
        return result;
    }

    return {
        name: "local",
        async putFile(localPath, key, o) {
            const dest = resolveKey(key);
            await fsp.mkdir(path.dirname(dest), { recursive: true });
            await fsp.copyFile(localPath, dest);
            return finish(dest, key, o);
        },
        async putBuffer(buf, key, o) {
            const dest = resolveKey(key);
            await fsp.mkdir(path.dirname(dest), { recursive: true });
            await fsp.writeFile(dest, buf);
            return finish(dest, key, o);
        },
        async remove(key) {
            try {
                await fsp.rm(resolveKey(key), { force: true });
                await fsp.rm(resolveKey(thumbKeyFor(key)), { force: true });
            } catch (err) {
                logger.warn({ message: "[storage] local remove failed", key, error: String(err) });
            }
        },
        keyFromUrl(url) {
            if (!url.startsWith(`${base}/`)) return null;
            try {
                const key = url
                    .slice(base.length + 1)
                    .split("?")[0]
                    .split("/")
                    .map(decodeURIComponent)
                    .join("/");
                assertSafeKey(key);
                return key;
            } catch {
                return null;
            }
        },
    };
}

/** Directory the API serves under /media. Exposed so index.ts can mount express.static. */
export function ensureDir(dir: string): string {
    const abs = path.resolve(dir);
    fs.mkdirSync(abs, { recursive: true });
    return abs;
}
