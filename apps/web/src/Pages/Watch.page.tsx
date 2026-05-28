import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

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
        const res = await fetch(`${base.replace(/\/$/, "")}/share/${shareId}`);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <Link to="/" className="text-xl font-semibold tracking-tight text-emerald-400">
          Stitcher
        </Link>
        <Link
          to="/auth"
          className="text-sm px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          Create your own
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-emerald-400 rounded-full" />
            <span>Loading video…</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold mb-2">Video unavailable</h1>
            <p className="text-zinc-400 mb-6">{error}</p>
            <Link to="/" className="text-emerald-400 hover:underline">
              Go to Stitcher →
            </Link>
          </div>
        )}

        {!loading && data && (
          <div className="w-full max-w-4xl">
            <div className="rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-zinc-800">
              <video
                src={data.videoUrl}
                poster={data.thumbnailUrl || undefined}
                controls
                autoPlay
                className="w-full aspect-video bg-black"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-medium">
                  {data.projectName || "Untitled Stitcher video"}
                </h1>
                <p className="text-sm text-zinc-500">
                  {Math.round(data.durationSec)}s · {data.views} view{data.views === 1 ? "" : "s"}
                </p>
              </div>
              <a
                href={data.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-900 transition-colors"
              >
                Open raw video
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-zinc-600 py-4 border-t border-zinc-900">
        Made with Stitcher — turn a prompt into an animated video.
      </footer>
    </div>
  );
};

export default WatchPage;
