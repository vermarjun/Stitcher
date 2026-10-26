export interface PutOptions {
    contentType?: string;
    /** Make a JPG thumbnail for videos when the backend can. Default true. */
    thumbnail?: boolean;
}

export interface StoredFile {
    /** Absolute URL the browser can load. */
    url: string;
    thumbnailUrl?: string;
    /** Backend-specific id. Pass it back to remove(). */
    key: string;
    bytes: number;
    /** Set by backends that learn it for free while storing (Cloudinary). */
    durationSec?: number;
}

export interface StorageBackend {
    readonly name: "local" | "cloudinary";
    /** Store a file from disk. The source file is left in place. */
    putFile(localPath: string, key: string, opts?: PutOptions): Promise<StoredFile>;
    putBuffer(buf: Buffer, key: string, opts?: PutOptions): Promise<StoredFile>;
    /** Delete a stored file (and its thumbnail). Never throws for a missing file. */
    remove(key: string): Promise<void>;
    /** Recover the key from a URL this backend produced, or null. */
    keyFromUrl(url: string): string | null;
}
