/**
 * exportTimeline.util.ts
 *
 * Renders the CURRENT timeline state (after user edits) into a single mp4:
 *   - video track items are trimmed to [sourceStartTime, sourceEndTime],
 *     normalized to a common resolution/fps, then concatenated in order
 *   - the first audio track item (if any) is muxed over the result, trimmed
 *     to the video length
 *   - the result is uploaded to Cloudinary and the secure URL returned
 *
 * Design notes:
 *   - Re-encodes each segment (libx264) because source clips can have different
 *     resolutions/fps/codecs; stream-copy concat would corrupt or desync them.
 *   - Normalizes with scale+pad so mismatched aspect ratios letterbox cleanly.
 *   - Downloads to a unique temp dir and always cleans it up.
 *   - assertHttpUrl guards against file:// SSRF.
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
import { assertHttpUrl } from "./ffmpegConcat.util";

export interface ExportVideoClip {
    url: string;
    sourceStartTime: number;
    sourceEndTime: number;
}

export interface ExportAudioClip {
    url: string;
    sourceStartTime: number;
    sourceEndTime: number;
}

export interface ExportResult {
    url: string;
    thumbnailUrl?: string;
    durationSec: number;
}

const OUT_W = 1920;
const OUT_H = 1080;
const OUT_FPS = 30;

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
            file.on("error", (err) => { file.destroy(); reject(err); });
        });
        req.on("error", (err) => { file.destroy(); reject(err); });
        req.setTimeout(120_000, () => {
            req.destroy();
            reject(new AppError(504, `Download timed out: ${url}`, "download_timeout"));
        });
    });
}

function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.debug({ message: "ffmpeg(export) spawn", args });
        const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
        const stderr: Buffer[] = [];
        proc.stderr?.on("data", (c: Buffer) => stderr.push(c));
        proc.on("close", (code) => {
            if (code === 0) return resolve();
            const tail = Buffer.concat(stderr).toString("utf8").slice(-2000);
            logger.error({ message: "ffmpeg(export) failed", code, stderr: tail });
            reject(new AppError(500, `ffmpeg exited ${code ?? "null"}: ${tail.slice(-300)}`, "ffmpeg_failed"));
        });
        proc.on("error", (err) => reject(new AppError(500, `ffmpeg spawn failed: ${err.message}`, "ffmpeg_spawn_failed")));
    });
}

/**
 * Build a single mp4 from the timeline's video + audio clips and upload it.
 */
export async function exportTimeline(
    videoClips: ExportVideoClip[],
    audioClips: ExportAudioClip[],
    cloudinaryFolder: string
): Promise<ExportResult> {
    if (videoClips.length === 0) {
        throw new AppError(400, "Nothing to export — the video track has no clips", "empty_timeline");
    }
    videoClips.forEach((c) => assertHttpUrl(c.url));
    audioClips.forEach((c) => assertHttpUrl(c.url));

    const tmpDir = path.join(os.tmpdir(), `stitcher-export-${crypto.randomUUID()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const cleanup = async () => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); }
        catch (err) { logger.warn({ message: "export cleanup failed", tmpDir, error: String(err) }); }
    };

    try {
        // 1. Download + trim/normalize each video clip into a uniform segment.
        const segPaths: string[] = [];
        let totalDuration = 0;
        for (let i = 0; i < videoClips.length; i++) {
            const clip = videoClips[i];
            const raw = path.join(tmpDir, `raw-${i}.mp4`);
            await downloadFile(clip.url, raw);

            const start = Math.max(0, clip.sourceStartTime || 0);
            const end = clip.sourceEndTime && clip.sourceEndTime > start ? clip.sourceEndTime : undefined;
            const seg = path.join(tmpDir, `seg-${String(i).padStart(4, "0")}.mp4`);

            const trimArgs = ["-ss", String(start)];
            if (end !== undefined) trimArgs.push("-to", String(end));
            totalDuration += end !== undefined ? end - start : 0;

            await runFfmpeg([
                "-y",
                ...trimArgs,
                "-i", raw,
                "-vf", `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUT_FPS}`,
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-an", // drop original audio; timeline audio is muxed separately
                seg,
            ]);
            segPaths.push(seg);
        }

        // 2. Concat the normalized segments (stream copy — they're already uniform).
        const listPath = path.join(tmpDir, "list.txt");
        fs.writeFileSync(listPath, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
        const concatPath = path.join(tmpDir, "concat.mp4");
        await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatPath]);

        // 3. Mux the first audio clip over the video, trimmed to video length.
        let finalPath = concatPath;
        if (audioClips.length > 0) {
            const audio = audioClips[0];
            const araw = path.join(tmpDir, "audio.src");
            await downloadFile(audio.url, araw);
            const withAudio = path.join(tmpDir, "final.mp4");
            const aStart = Math.max(0, audio.sourceStartTime || 0);
            await runFfmpeg([
                "-y",
                "-i", concatPath,
                "-ss", String(aStart), "-i", araw,
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                withAudio,
            ]);
            finalPath = withAudio;
        }

        // 4. Upload to Cloudinary.
        const uploaded = await cloudinary.uploader.upload(finalPath, {
            resource_type: "video",
            folder: cloudinaryFolder,
            eager: [{ width: 640, height: 360, crop: "fill", format: "jpg", start_offset: "1" }],
            eager_async: false,
        });
        const thumbnailUrl = Array.isArray(uploaded.eager) && uploaded.eager.length > 0
            ? (uploaded.eager[0] as { secure_url?: string }).secure_url
            : undefined;

        return {
            url: uploaded.secure_url,
            thumbnailUrl,
            durationSec: Number(uploaded.duration ?? totalDuration ?? 0),
        };
    } finally {
        await cleanup();
    }
}
