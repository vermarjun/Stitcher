/**
 * Storage layer. Every file the API keeps (final videos, uploads, profile
 * photos) goes through `storage`.
 *
 *   STORAGE=local       (default) files live in STORAGE_DIR and the API serves
 *                       them at ${API_PREFIX}/media/<key>.
 *   STORAGE=cloudinary  files go to Cloudinary (CLOUDINARY_* required).
 */

import path from "path";
import { API_PREFIX, PUBLIC_API_URL, config } from "../config";
import { createLocalStorage, ensureDir } from "./local";
import { createCloudinaryStorage } from "./cloudinary";
import type { StorageBackend } from "./types";

export type { PutOptions, StoredFile, StorageBackend } from "./types";
export { createLocalStorage } from "./local";

/** Absolute directory holding local files (used for the static /media mount). */
export const STORAGE_ROOT = path.resolve(config.STORAGE_DIR);

function build(): StorageBackend {
    if (config.STORAGE === "cloudinary") return createCloudinaryStorage();
    ensureDir(STORAGE_ROOT);
    return createLocalStorage({ dir: STORAGE_ROOT, publicBase: `${PUBLIC_API_URL}${API_PREFIX}/media` });
}

export const storage: StorageBackend = build();
