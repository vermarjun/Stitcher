import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { CLOUDINARY_CONFIG } from "../config";
import logger from "../util/logger.util";
import type { PutOptions, StorageBackend, StoredFile } from "./types";

type ResourceType = "video" | "image" | "raw";

function resourceTypeFor(key: string, contentType?: string): ResourceType {
    const ct = contentType ?? "";
    if (ct.startsWith("video/") || ct.startsWith("audio/")) return "video"; // Cloudinary stores audio as "video"
    if (ct.startsWith("image/")) return "image";
    const ext = path.extname(key).toLowerCase();
    if ([".mp4", ".mov", ".webm", ".mkv", ".m4v", ".mp3", ".wav", ".m4a", ".ogg", ".aac"].includes(ext)) return "video";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)) return "image";
    return "raw";
}

/** Cloudinary public id: the key without its extension (raw files keep it). */
function publicIdFor(key: string, rt: ResourceType): string {
    return rt === "raw" ? key : key.replace(/\.[^./]+$/, "");
}

export function createCloudinaryStorage(): StorageBackend {
    cloudinary.config({ ...CLOUDINARY_CONFIG, secure: true });

    function toStored(res: { secure_url: string; bytes?: number; duration?: number; eager?: unknown }, key: string): StoredFile {
        const eager = Array.isArray(res.eager) && res.eager.length > 0 ? (res.eager[0] as { secure_url?: string }) : undefined;
        return {
            url: res.secure_url,
            thumbnailUrl: eager?.secure_url,
            key,
            bytes: Number(res.bytes ?? 0),
            durationSec: res.duration !== undefined ? Number(res.duration) : undefined,
        };
    }

    function uploadOptions(key: string, o?: PutOptions) {
        const rt = resourceTypeFor(key, o?.contentType);
        return {
            rt,
            options: {
                resource_type: rt,
                public_id: publicIdFor(key, rt),
                overwrite: true,
                ...(rt === "video" && o?.contentType?.startsWith("audio/") !== true && o?.thumbnail !== false
                    ? {
                          eager: [{ width: 640, height: 360, crop: "fill", format: "jpg", start_offset: "1" }],
                          eager_async: false,
                      }
                    : {}),
            },
        };
    }

    return {
        name: "cloudinary",
        async putFile(localPath, key, o) {
            const { options } = uploadOptions(key, o);
            const res = await cloudinary.uploader.upload(localPath, options);
            return toStored(res, key);
        },
        async putBuffer(buf, key, o) {
            const { options } = uploadOptions(key, o);
            const res = await new Promise<{ secure_url: string; bytes?: number; duration?: number; eager?: unknown }>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
                    if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
                    resolve(result);
                });
                stream.end(buf);
            });
            return toStored(res, key);
        },
        async remove(key) {
            // The resource type is not stored with the key, so try each.
            for (const rt of ["video", "image", "raw"] as const) {
                try {
                    const r = await cloudinary.uploader.destroy(publicIdFor(key, rt), { resource_type: rt, invalidate: true });
                    if (r.result === "ok") return;
                } catch (err) {
                    logger.warn({ message: "[storage] cloudinary remove failed", key, resourceType: rt, error: String(err) });
                }
            }
        },
        keyFromUrl() {
            return null; // Cloudinary URLs are not mapped back; callers use the stored key.
        },
    };
}
