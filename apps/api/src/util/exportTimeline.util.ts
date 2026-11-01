/**
 * exportTimeline.util.ts
 *
 * Renders the CURRENT timeline state (after user edits) into a single mp4:
 *   - video track items are trimmed to [sourceStartTime, sourceEndTime],
 *     normalized to a common resolution/fps, then concatenated in order
 *   - each clip's OWN audio (e.g. the baked-in voiceover) is preserved; clips
 *     without audio get a silent track so stream-copy concat stays uniform
 *   - a separate audio track item (if any) is mixed OVER the result, so adding
 *     background music never silences the narration
 *   - the result is stored through the storage layer and its URL returned
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
import { storage } from "../storage";
import { probeMedia } from "./probe.util";
import { AppError } from "./AppError";
import logger from "./logger.util";
import { assertHttpUrl } from "./url.util";

export interface ExportVideoClip {
    url: string;
    sourceStartTime: number;
    sourceEndTime: number;
}

export interface ExportAudioClip {
    url: string;
    /** Position on the timeline, in seconds, where this clip starts playing. */
    startTime?: number;
    sourceStartTime: number;
    sourceEndTime: number;
    /** Linear gain; 1 = unchanged. Defaults to 1. */
    volume?: number;
    /** Fade in/out durations in seconds; 0/undefined = no fade. */
    fadeIn?: number;
    fadeOut?: number;
}

export interface ExportTextClip {
    content: string;
    startTime: number;
    endTime: number;
    /** 0–100 percent of frame, center-anchored (matches the player). */
    x: number;
    y: number;
    /** Font size in player-preview px; scaled to output height below. */
    fontSize: number;
    color: string;
}

export interface ExportResult {
    url: string;
    thumbnailUrl?: string;
    durationSec: number;
    warnings?: string[];
}

// drawtext needs libfreetype. Detect once and cache; some minimal ffmpeg
// builds (e.g. certain Homebrew bottles) omit it. Production Alpine ffmpeg
// includes it, so text overlays render there.
let _drawTextSupported: boolean | null = null;
function hasDrawText(): Promise<boolean> {
    if (_drawTextSupported !== null) return Promise.resolve(_drawTextSupported);
    return new Promise((resolve) => {
        const proc = spawn(FFMPEG_BIN, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] });
        const out: Buffer[] = [];
        proc.stdout?.on("data", (c: Buffer) => out.push(c));
        proc.on("close", () => {
            _drawTextSupported = Buffer.concat(out).toString("utf8").includes("drawtext");
            resolve(_drawTextSupported);
        });
        proc.on("error", () => { _drawTextSupported = false; resolve(false); });
    });
}

const OUT_W = 1920;
const OUT_H = 1080;
const OUT_FPS = 30;

// Which ffmpeg binary to use for export. Defaults to PATH's `ffmpeg`, but can
// point at a freetype-enabled build (for drawtext) via EXPORT_FFMPEG_PATH —
// useful on dev machines whose system ffmpeg is a minimal build.
const FFMPEG_BIN = process.env["EXPORT_FFMPEG_PATH"] || "ffmpeg";

// The player previews at roughly this height; text fontSize is authored
// against it, so scale fontSize to the 1080p export by this ratio.
const PREVIEW_REF_HEIGHT = 405;
const FONT_SCALE = OUT_H / PREVIEW_REF_HEIGHT;

// Recursively find the first .ttf/.otf under `dir` (bounded depth), preferring
// a common sans-serif face. Lets us locate a usable font no matter which font
// package the host/container happens to ship or where it installs it.
function findFontInDir(dir: string, depth: number): string | null {
    if (depth < 0) return null;
    let entries: import("fs").Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return null; }
    const isFont = (n: string) => /\.(ttf|otf)$/i.test(n);
    const preferred = (n: string) => /(dejavusans|liberationsans|arial|helvetica|noto.*sans|sans)/i.test(n);
    const files = entries.filter((e) => e.isFile() && isFont(e.name));
    const pref = files.find((e) => preferred(e.name));
    if (pref) return path.join(dir, pref.name);
    if (files.length) return path.join(dir, files[0]!.name);
    for (const e of entries) {
        if (e.isDirectory()) {
            const found = findFontInDir(path.join(dir, e.name), depth - 1);
            if (found) return found;
        }
    }
    return null;
}

// First existing font wins. Override with EXPORT_FONT_PATH.
function resolveFontFile(): string | null {
    const explicit = [
        process.env["EXPORT_FONT_PATH"],
        "/System/Library/Fonts/Supplemental/Arial.ttf",      // macOS
        "/Library/Fonts/Arial.ttf",                          // macOS (user)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",   // Debian/Ubuntu
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",            // Alpine/Fedora
    ].filter(Boolean) as string[];
    for (const p of explicit) {
        try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
    }
    // Fallback: scan common font directories for any usable face.
    const fontDirs = [
        "/usr/share/fonts",
        "/usr/local/share/fonts",
        "/System/Library/Fonts",
        "/Library/Fonts",
    ];
    for (const dir of fontDirs) {
        const found = findFontInDir(dir, 4);
        if (found) return found;
    }
    return null;
}

// Escape a string for the ffmpeg drawtext `text=` value.
// drawtext treats : \ ' % specially and needs newlines stripped.
function escapeDrawText(s: string): string {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "’") // curly apostrophe — avoids quoting hell
        .replace(/%/g, "\\%")
        .replace(/[\r\n]+/g, " ")
        .trim();
}

// Normalize a CSS color to ffmpeg-friendly form (#rrggbb → 0xRRGGBB; names pass through).
function normalizeColor(c: string | undefined): string {
    if (!c) return "white";
    const hex = c.trim();
    if (/^#([0-9a-fA-F]{6})$/.test(hex)) return "0x" + hex.slice(1);
    if (/^#([0-9a-fA-F]{3})$/.test(hex)) {
        const r = hex[1], g = hex[2], b = hex[3];
        return "0x" + r + r + g + g + b + b;
    }
    return hex; // named color (white, red, …)
}

// Build a drawtext filter chain for the text overlays. Empty string if there
// are no text clips OR no usable font — drawtext without an explicit fontfile
// falls back to the fontconfig family "Sans", which fails on hosts that don't
// ship it (e.g. a bare Alpine container), so we never emit that form.
function buildDrawTextChain(textClips: ExportTextClip[], fontFile: string | null): string {
    if (textClips.length === 0 || !fontFile) return "";
    const filters = textClips
        .filter((t) => (t.content ?? "").trim().length > 0)
        .map((t) => {
            const text = escapeDrawText(t.content);
            const fontsize = Math.max(8, Math.round((t.fontSize || 24) * FONT_SCALE));
            const color = normalizeColor(t.color);
            const xFrac = Math.min(1, Math.max(0, (t.x ?? 50) / 100));
            const yFrac = Math.min(1, Math.max(0, (t.y ?? 50) / 100));
            const parts = [
                `fontfile='${fontFile}'`,
                `text='${text}'`,
                `fontsize=${fontsize}`,
                `fontcolor=${color}`,
                // center the text box on (x%, y%)
                `x=(w*${xFrac.toFixed(4)})-(text_w/2)`,
                `y=(h*${yFrac.toFixed(4)})-(text_h/2)`,
                // subtle shadow for legibility on any background
                `shadowcolor=black@0.6`, `shadowx=2`, `shadowy=2`,
                `enable='between(t,${t.startTime.toFixed(3)},${t.endTime.toFixed(3)})'`,
            ].filter(Boolean);
            return `drawtext=${parts.join(":")}`;
        });
    return filters.join(",");
}

// Return true if the file has at least one audio stream. Uses ffprobe (present in
// the same container as ffmpeg); on any failure returns false, matching the
// convention in ffmpegConcat.util.ts. A clip reported as silent gets a synthetic
// silent track added so concat stays uniform.
function probeHasAudio(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn(
            "ffprobe",
            ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", filePath],
            { stdio: ["ignore", "pipe", "pipe"] }
        );
        const out: Buffer[] = [];
        proc.stdout?.on("data", (c: Buffer) => out.push(c));
        proc.on("close", () => resolve(Buffer.concat(out).toString("utf8").includes("audio")));
        proc.on("error", () => resolve(false));
    });
}

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
        const proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
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
    storageFolder: string,
    textClips: ExportTextClip[] = []
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

            // Preserve the clip's own audio (the voiceover is baked into the video
            // track) re-encoded to a uniform AAC layout. Clips that genuinely have no
            // audio get a synthetic silent track so every segment carries exactly one
            // matching audio stream — required for the stream-copy concat below to keep
            // audio instead of silently dropping it.
            const segHasAudio = await probeHasAudio(raw);
            const vfChain = `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUT_FPS}`;
            const audioCodecArgs = ["-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k"];

            await runFfmpeg(
                segHasAudio
                    ? [
                        "-y",
                        ...trimArgs,
                        "-i", raw,
                        "-vf", vfChain,
                        "-map", "0:v:0", "-map", "0:a:0",
                        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                        ...audioCodecArgs,
                        seg,
                    ]
                    : [
                        "-y",
                        ...trimArgs,
                        "-i", raw,
                        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                        "-vf", vfChain,
                        "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                        ...audioCodecArgs,
                        "-shortest",
                        seg,
                    ]
            );
            segPaths.push(seg);
        }

        // 2. Concat the normalized segments (stream copy — they're already uniform).
        const listPath = path.join(tmpDir, "list.txt");
        fs.writeFileSync(listPath, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
        const concatPath = path.join(tmpDir, "concat.mp4");
        await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatPath]);

        // 2b. Burn in text overlays (drawtext), timed to the timeline.
        const warnings: string[] = [];
        let videoPath = concatPath;
        const fontFile = resolveFontFile();
        const hasText = textClips.some((t) => (t.content ?? "").trim().length > 0);
        const drawChain = buildDrawTextChain(textClips, fontFile);
        if (drawChain) {
            if (await hasDrawText()) {
                const titled = path.join(tmpDir, "titled.mp4");
                await runFfmpeg([
                    "-y",
                    "-i", concatPath,
                    "-vf", drawChain,
                    "-map", "0:v:0", "-map", "0:a:0?",
                    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                    "-c:a", "copy", // keep the concatenated audio (voiceover) through the text burn-in
                    titled,
                ]);
                videoPath = titled;
            } else {
                const msg = "Text overlays were skipped: this ffmpeg build lacks the drawtext filter (libfreetype). Production renders text correctly.";
                logger.warn({ message: "[export] " + msg });
                warnings.push(msg);
            }
        } else if (hasText && !fontFile) {
            // Text exists but no usable font on this host — skip the overlay
            // rather than emitting a drawtext that crashes the whole render.
            const msg = "Text overlays were skipped: no usable font found on the render host. Install a font (e.g. `apk add font-dejavu`) or set EXPORT_FONT_PATH.";
            logger.warn({ message: "[export] " + msg });
            warnings.push(msg);
        }

        // 3. Mix the video's existing audio (the baked-in voiceover) with EVERY external
        //    audio-track clip. Each clip is trimmed to its source range, positioned at its
        //    timeline startTime (adelay), volume-scaled and optionally faded — matching how
        //    the editor's player layers them. Mixing (not replacing) with normalize=0 keeps
        //    the narration at full level under any added music/SFX.
        let finalPath = videoPath;
        if (audioClips.length > 0) {
            const STD_FMT = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
            const inputArgs: string[] = ["-i", videoPath];
            // Normalize the video's own audio so all mix inputs share one format.
            const filterParts: string[] = [`[0:a]${STD_FMT}[a0]`];
            const mixLabels: string[] = ["[a0]"];

            for (let i = 0; i < audioClips.length; i++) {
                const a = audioClips[i];
                const ss = Math.max(0, a.sourceStartTime || 0);
                const end = a.sourceEndTime && a.sourceEndTime > ss ? a.sourceEndTime : undefined;
                const dur = end !== undefined ? end - ss : undefined;

                const araw = path.join(tmpDir, `audio-${i}.src`);
                await downloadFile(a.url, araw);

                // Trim the source range via fast input seeking.
                inputArgs.push("-ss", String(ss));
                if (dur !== undefined) inputArgs.push("-t", String(dur));
                inputArgs.push("-i", araw);

                const inIdx = i + 1; // input 0 is the video
                const vol = typeof a.volume === "number" && a.volume >= 0 ? a.volume : 1;
                const delayMs = Math.max(0, Math.round((a.startTime || 0) * 1000));
                const chain = [`[${inIdx}:a]${STD_FMT}`, `volume=${vol}`];
                if (a.fadeIn && a.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${a.fadeIn}`);
                if (a.fadeOut && a.fadeOut > 0 && dur !== undefined) {
                    chain.push(`afade=t=out:st=${Math.max(0, dur - a.fadeOut)}:d=${a.fadeOut}`);
                }
                // Position the clip on the timeline. adelay needs a per-channel value.
                if (delayMs > 0) chain.push(`adelay=${delayMs}|${delayMs}`);
                const label = `[a${inIdx}]`;
                filterParts.push(`${chain.join(",")}${label}`);
                mixLabels.push(label);
            }

            filterParts.push(
                `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[aout]`
            );

            const withAudio = path.join(tmpDir, "final.mp4");
            await runFfmpeg([
                "-y",
                ...inputArgs,
                "-filter_complex", filterParts.join(";"),
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                withAudio,
            ]);
            finalPath = withAudio;
        }

        // 4. Store the result.
        const key = `${storageFolder}/${crypto.randomUUID()}.mp4`;
        const stored = await storage.putFile(finalPath, key, { contentType: "video/mp4" });
        const probed = await probeMedia(finalPath);

        return {
            url: stored.url,
            thumbnailUrl: stored.thumbnailUrl,
            durationSec: Number(probed?.durationSec ?? stored.durationSec ?? totalDuration ?? 0),
            warnings: warnings.length ? warnings : undefined,
        };
    } finally {
        await cleanup();
    }
}
