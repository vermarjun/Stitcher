// Shared helpers for the share-preview serverless functions (/v/:id and /embed/:id).
// These run on Vercel's Node runtime — they are NOT part of the Vite client bundle.
// Files prefixed with "_" are ignored by Vercel's routing layer but still bundled
// when imported, so this never becomes a public endpoint.

export interface ShareData {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSec?: number;
  projectName?: string;
  views?: number;
  createdAt?: string;
}

// Where the Stitcher API lives. VITE_BACKEND_URL already includes the /api prefix
// (e.g. https://stitcherapi.duckdns.org/api) and is configured in the Vercel project
// for the client build, so it is also present in process.env at function runtime.
// STITCHER_API_ORIGIN lets you override it for the functions only if ever needed.
export function apiBase(): string {
  const raw = process.env.STITCHER_API_ORIGIN || process.env.VITE_BACKEND_URL || "";
  return raw.replace(/\/$/, "");
}

// Best-effort fetch of a shared video's public metadata via GET /api/share/:shareId.
// Returns null on any failure so the caller can fall back to generic branding rather
// than erroring the whole page (crawlers must always get a valid response).
export async function fetchShare(shareId: string): Promise<ShareData | null> {
  const base = apiBase();
  if (!shareId || !base) return null;
  try {
    const r = await fetch(`${base}/share/${encodeURIComponent(shareId)}`);
    const j: any = await r.json();
    if (!r.ok || !j?.success || !j?.data?.videoUrl) return null;
    return j.data as ShareData;
  } catch {
    return null;
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// For values that land inside a double-quoted HTML attribute (meta content="...").
export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// A poster/thumbnail URL for the share. Prefers the stored Cloudinary thumbnail;
// falls back to a JPG frame derived from the mp4 URL (Cloudinary renders a frame
// when the extension is swapped) for older shares saved without a thumbnail.
export function posterFor(data: ShareData): string {
  if (data.thumbnailUrl) return data.thumbnailUrl;
  if (/\.mp4($|\?)/i.test(data.videoUrl)) return data.videoUrl.replace(/\.mp4($|\?)/i, ".jpg$1");
  return "";
}
