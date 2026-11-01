import { spawn } from "child_process";

export interface MediaInfo {
    durationSec?: number;
    width?: number;
    height?: number;
    hasAudio: boolean;
    hasVideo: boolean;
}

/**
 * Read duration and size with ffprobe. Returns null when ffprobe is missing or
 * the file is not readable media; callers treat the metadata as optional.
 */
export function probeMedia(filePath: string): Promise<MediaInfo | null> {
    return new Promise((resolve) => {
        let proc;
        try {
            proc = spawn(
                "ffprobe",
                ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
                { stdio: ["ignore", "pipe", "ignore"] }
            );
        } catch {
            return resolve(null);
        }
        const out: Buffer[] = [];
        proc.stdout?.on("data", (c: Buffer) => out.push(c));
        proc.on("error", () => resolve(null));
        proc.on("close", (code) => {
            if (code !== 0) return resolve(null);
            try {
                const json = JSON.parse(Buffer.concat(out).toString("utf8")) as {
                    format?: { duration?: string };
                    streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
                };
                const streams = json.streams ?? [];
                const video = streams.find((s) => s.codec_type === "video");
                const audio = streams.find((s) => s.codec_type === "audio");
                const d = parseFloat(json.format?.duration ?? video?.duration ?? audio?.duration ?? "");
                resolve({
                    durationSec: Number.isFinite(d) ? d : undefined,
                    width: video?.width,
                    height: video?.height,
                    hasVideo: !!video,
                    hasAudio: !!audio,
                });
            } catch {
                resolve(null);
            }
        });
    });
}
