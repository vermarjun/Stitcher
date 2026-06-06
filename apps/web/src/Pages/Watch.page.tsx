import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ExternalLink, Loader2, PlayCircle } from "lucide-react";

interface ShareData {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSec: number;
  projectName?: string;
  views: number;
  createdAt: string;
}

// Public, no-auth page that plays a shared Stitcher video by its share token.
// Uses a plain fetch (not the auth axios instance) so anonymous viewers aren't
// bounced to /auth by the token-expiry interceptor.
const WatchPage = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:3100/api";
    let cancelled = false;
    (async () => {
      try {
        // ?count=1 → this is a real watch, so the view counter increments here (the
        // link-preview function reads without it, so unfurls/crawlers don't inflate views).
        const res = await fetch(`${base.replace(/\/$/, "")}/share/${shareId}?count=1`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setError(json.message || "This shared video could not be found.");
        } else {
          setData(json.data as ShareData);
        }
      } catch {
        if (!cancelled) setError("Couldn't reach the server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shareId]);

  // Keep the tab title in sync for in-app navigation (direct loads already get the
  // right <title> server-injected by the /v/:id preview function).
  useEffect(() => {
    if (data?.projectName) document.title = `${data.projectName} · Stitcher`;
    else if (error) document.title = "Video unavailable · Stitcher";
  }, [data, error]);

  const metaDate = data?.createdAt
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(data.createdAt))
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-neutral-950 px-5 py-4">
        <Link to="/" className="text-sm font-semibold tracking-tight text-white">
          Stitcher
        </Link>
        <Link
          to="/auth"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          Create your own
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading video...</span>
          </div>
        )}

        {!loading && error && (
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/60 p-8 text-center">
            <PlayCircle className="mx-auto mb-4 h-8 w-8 text-zinc-300" />
            <h1 className="mb-2 text-xl font-semibold">Video unavailable</h1>
            <p className="mb-6 text-sm text-zinc-400">{error}</p>
            <Link to="/" className="text-sm font-medium text-zinc-200 hover:text-white">
              Go to Stitcher
            </Link>
          </div>
        )}

        {!loading && data && (
          <div className="w-full max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl shadow-black">
              <video
                src={data.videoUrl}
                poster={data.thumbnailUrl || undefined}
                controls
                autoPlay
                className="aspect-video w-full bg-black"
              />
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-medium text-white">
                  {data.projectName || "Untitled Stitcher video"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  {Math.round(data.durationSec)}s
                  {" / "}
                  {data.views} view{data.views === 1 ? "" : "s"}
                  {metaDate ? ` / ${metaDate}` : ""}
                </p>
              </div>
              <a
                href={data.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Open video
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
        Made with Stitcher
      </footer>
    </div>
  );
};

export default WatchPage;
