import { AppError } from "./AppError";

/** Throw unless the URL is http or https. Blocks file:// and other schemes (SSRF guard). */
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
            `Unsafe URL protocol '${parsed.protocol}', only http/https allowed`,
            "unsafe_url_protocol"
        );
    }
}
