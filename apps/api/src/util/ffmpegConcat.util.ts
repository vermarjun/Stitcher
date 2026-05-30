/**
 * ffmpegConcat.util.ts
 *
 * Utilities for concatenating per-scene mp4 files and uploading the result
 * to Cloudinary.
 *
 * Design decisions:
 *   - Uses child_process.spawn (not exec) to avoid shell injection.
 *   - fluent-ffmpeg is installed but we use spawn directly for the concat step:
 *     fluent-ffmpeg's concat API doesn't map cleanly to the `-f concat -safe 0`
 *     filter-graph idiom (it re-encodes by default). spawn gives exact control.
 *   - Downloads videos to os.tmpdir() to avoid writing to the source tree.
 *   - Validates URLs are http/https to prevent file:// SSRF-style reads.
 *   - cleanup() deletes the entire temp working dir.
 *   - Uses existing cloudinary.util.ts singleton (wraps the Cloudinary v2 SDK).
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";
import https from "https";
import http from "http";
import cloudinary from "./cloudinary.util";
import { AppError } from "./AppError";
import logger from "./logger.util";

// ─── URL validation ───────────────────────────────────────────────────────────

// Exported for unit testing in ffmpegConcat.util.test.ts.
// It is a pure validator with no side-effects; exporting it is safe.
export function assertHttpUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new AppError(400, `Invalid URL: ${url}`, "invalid_url");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new AppError(
            400,
            `Unsafe URL protocol '${parsed.protocol}' — only http/https allowed`,
            "unsafe_url_protocol"
        );
    }
}

// ─── HTTP download helper ─────────────────────────────────────────────────────

function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith("https:") ? https : http;
        const file = fs.createWriteStream(destPath);

        const req = proto.get(url, (res) => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                file.destroy();
                reject(new AppError(502, `Download failed: HTTP ${res.statusCode} for ${url}`, "download_failed"));
                return;
            }
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
            file.on("error", (err) => {
                file.destroy();
                reject(err);
            });
        });

        req.on("error", (err) => {
            file.destroy();
            reject(err);
        });

        // 60 second timeout per download
        req.setTimeout(60_000, () => {
            req.destroy();
            reject(new AppError(504, `Download timed out: ${url}`, "download_timeout"));
        });
    });
}

// ─── ffmpeg spawn ─────────────────────────────────────────────────────────────

function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.debug({ message: "ffmpeg spawn", args });

        // Never pass args through a shell — spawn uses execvp directly.
        const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

        const stderr: Buffer[] = [];
        proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                const errText = Buffer.concat(stderr).toString("utf8").slice(-2000);
                logger.error({ message: "ffmpeg exited non-zero", code, stderr: errText });
                reject(
                    new AppError(
                        500,
                        `ffmpeg exited with code ${code ?? "null"}`,
                        "ffmpeg_failed"
                    )
                );
            }
        });

        proc.on("error", (err) => {
            reject(
                new AppError(
                    500,
                    `Failed to spawn ffmpeg: ${err.message}`,
                    "ffmpeg_spawn_failed"
                )
            );
        });
    });
}

// ─── ffprobe audio detection ──────────────────────────────────────────────────

/**
 * Return true if the file has at least one audio stream. Uses ffprobe; on any
 * failure returns false (conservative — falls back to the fast video-only path).
 */
function probeHasAudio(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn(
            "ffprobe",
            ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", filePath],
            { stdio: ["ignore", "pipe", "pipe"] }
        );
        const out: Buffer[] = [];
        proc.stdout?.on("data", (c: Buffer) => out.push(c));
        proc.on("close", () => {
            resolve(Buffer.concat(out).toString("utf8").includes("audio"));
        });
        proc.on("error", () => resolve(false));
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ConcatResult {
    filePath: string;
    cleanup: () => Promise<void>;
}

/**
 * Download each URL to a temp dir, concat with ffmpeg, return the output path
 * and a cleanup function that deletes the temp dir.
 *
 * @param urls       HTTP/HTTPS URLs of per-scene mp4 files (ordered).
 * @param outputName Filename for the output, without directory (e.g. "final.mp4").
 */
export async function concatVideos(urls: string[], outputName: string): Promise<ConcatResult> {
    if (urls.length === 0) {
        throw new AppError(400, "concatVideos: no URLs provided", "no_scenes");
    }

    // Validate all URLs before doing any I/O
    for (const url of urls) {
        assertHttpUrl(url);
    }

    // Unique temp dir per call — prevents races if multiple workers run on the same host
    const tmpDir = path.join(os.tmpdir(), `stitcher-concat-${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const cleanup = async (): Promise<void> => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (err) {
            logger.warn({ message: "ffmpegConcat cleanup failed", tmpDir, error: String(err) });
        }
    };

    try {
        // 1. Download all files in parallel
        const localPaths = await Promise.all(
            urls.map(async (url, i) => {
                const dest = path.join(tmpDir, `scene-${String(i).padStart(4, "0")}.mp4`);
                await downloadFile(url, dest);
                return dest;
            })
        );

        // 2. Decide concat strategy from REAL stream inspection.
        //
        //    Video-only (no voiceover): every input is a uniform video-only mp4,
        //    so `-f concat -c copy` (stream copy, no re-encode) is fast and clean —
        //    this is the existing, unchanged behavior.
        //
        //    Voiceover ON: every scene mp4 has a baked AAC track. `-f concat -c copy`
        //    across separately-encoded AAC streams can drop/desync audio at the
        //    boundaries (encoder delay / priming samples per file, non-monotonic
        //    timestamps). When ANY input has audio we use the concat FILTER
        //    (`-filter_complex concat=n=N:v=1:a=1`) which decodes + re-encodes into
        //    one continuous A/V stream — proven by ffprobe to preserve a single
        //    audio track whose duration ≈ sum of inputs. We re-encode only in this
        //    case; the fast copy path is untouched for video-only generations.
        const anyHasAudio = (await Promise.all(localPaths.map(probeHasAudio))).some(Boolean);

        const outputPath = path.join(tmpDir, outputName);

        if (anyHasAudio) {
            logger.debug({ message: "ffmpegConcat: audio detected — using concat filter (re-encode)", count: localPaths.length });
            // Build: -i a.mp4 -i b.mp4 ... -filter_complex "[0:v][0:a][1:v][1:a]concat=n=N:v=1:a=1[v][a]" -map [v] -map [a]
            const inputArgs: string[] = [];
            for (const p of localPaths) {
                inputArgs.push("-i", p);
            }
            const streamRefs = localPaths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
            const filter = `${streamRefs}concat=n=${localPaths.length}:v=1:a=1[outv][outa]`;
            await runFfmpeg([
                "-y",
                ...inputArgs,
                "-filter_complex", filter,
                "-map", "[outv]",
                "-map", "[outa]",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                outputPath,
            ]);
        } else {
            // Write concat list for the fast stream-copy path (video-only).
            const listPath = path.join(tmpDir, "concat.txt");
            const listContent = localPaths
                .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
                .join("\n");
            fs.writeFileSync(listPath, listContent, "utf8");

            await runFfmpeg([
                "-y",               // overwrite output
                "-f", "concat",
                "-safe", "0",       // allow absolute paths in the list file
                "-i", listPath,
                "-c", "copy",       // stream copy — no re-encode
                outputPath,
            ]);
        }

        return { filePath: outputPath, cleanup };
    } catch (err) {
        // Best-effort cleanup on error
        await cleanup();
        throw err;
    }
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

export interface CloudinaryUploadResult {
    url: string;
    thumbnailUrl?: string;
}

/**
 * Upload a local video file to Cloudinary and return the secure URL.
 * Generates a thumbnail at 1 second if `generateThumbnail` is true (default).
 *
 * @param filePath         Absolute path to the local mp4 file.
 * @param folder           Cloudinary folder (e.g. "stitcher/generated").
 */
export async function uploadConcatToCloudinary(
    filePath: string,
    folder: string
): Promise<CloudinaryUploadResult> {
    logger.debug({ message: "Uploading to Cloudinary", filePath, folder });

    const uploadResult = await cloudinary.uploader.upload(filePath, {
        resource_type: "video",
        folder,
        eager: [
            // Generate a thumbnail jpg at the 1-second mark
            { width: 640, height: 360, crop: "fill", format: "jpg", start_offset: "1" },
        ],
        eager_async: false,
    });

    const thumbnailUrl =
        Array.isArray(uploadResult.eager) && uploadResult.eager.length > 0
            ? (uploadResult.eager[0] as { secure_url?: string }).secure_url
            : undefined;

    return {
        url: uploadResult.secure_url,
        thumbnailUrl,
    };
}
