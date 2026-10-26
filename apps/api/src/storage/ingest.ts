import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { pipeline } from "stream/promises";
import { AppError } from "../util/AppError";
import { storage } from "./index";
import type { PutOptions, StoredFile } from "./types";

/**
 * Copy a file the render service produced into API storage.
 *
 * The render service returns a URL. If it is file://, its local storage has no
 * public URL base, so the API cannot read it. Fail with a message that tells
 * the operator what to set.
 */
export async function ingestRenderedFile(renderUrl: string, key: string, opts?: PutOptions): Promise<StoredFile> {
    if (renderUrl.startsWith("file:")) {
        throw new AppError(
            500,
            "The render service returned a file:// URL, which the API cannot download. " +
                "Set LOCAL_STORAGE_PUBLIC_URL_BASE on the render service to a URL the API can reach " +
                "(for example http://render:8000/files).",
            "render_file_url"
        );
    }
    let parsed: URL;
    try {
        parsed = new URL(renderUrl);
    } catch {
        throw new AppError(502, `Render service returned an invalid URL: ${renderUrl}`, "render_bad_url");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new AppError(502, `Render service returned an unsupported URL: ${renderUrl}`, "render_bad_url");
    }

    const tmp = path.join(os.tmpdir(), `stitcher-ingest-${crypto.randomUUID()}${path.extname(key)}`);
    try {
        const res = await axios.get(renderUrl, { responseType: "stream", timeout: 120_000 });
        await pipeline(res.data, fs.createWriteStream(tmp));
        return await storage.putFile(tmp, key, opts);
    } finally {
        await fs.promises.unlink(tmp).catch(() => undefined);
    }
}
