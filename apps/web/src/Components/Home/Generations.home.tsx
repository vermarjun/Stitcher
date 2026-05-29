/**
 * Generations history panel (F2.4).
 *
 * Shows the authenticated user's generation + edit jobs in two sections:
 *   - "In Progress": active jobs with a per-scene progress bar (done/total) and
 *     the current status label.
 *   - "Recent": terminal jobs with a status badge, a link to the final video,
 *     a relative timestamp, and the error message when failed.
 *
 * Data source: GET /generatechat/jobs (newest-first, ownership-scoped by JWT).
 * We fetch `active` and `recent` separately so each section is independently
 * paginated/limited.
 *
 * Live updates (nice-to-have): we subscribe to the existing Socket.IO
 * `chat_update` events (same channel the Generate sidebar uses) and bump an
 * in-progress row's scene progress / status optimistically as events arrive.
 * The events are keyed by chatId, which matches GenerationJob.chatId.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Clapperboard,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Film,
  Pencil,
} from "lucide-react";
import api from "@/api";
import { socket } from "@/socket";

// ─── Types ──────────────────────────────────────────────────────────────────

type JobStatus =
  | "queued"
  | "planning"
  | "rendering"
  | "concatenating"
  | "uploading"
  | "complete"
  | "failed"
  | "cancelled";

interface GenerationJobRow {
  _id: string;
  jobId: string;
  queue: "generation" | "edit";
  projectId?: string;
  chatId?: string;
  prompt: string;
  status: JobStatus;
  sceneProgress: { done: number; total: number };
  finalUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  planning: "Planning",
  rendering: "Rendering",
  concatenating: "Concatenating",
  uploading: "Uploading",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date?: string) {
  if (!date) return "";
  const past = new Date(date);
  const seconds = Math.floor((Date.now() - past.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return past.toLocaleDateString();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: JobStatus }) => {
  const styles: Record<JobStatus, string> = {
    complete: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-zinc-800 text-zinc-400 border-zinc-700",
    queued: "bg-zinc-800 text-zinc-400 border-zinc-700",
    planning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rendering: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    concatenating: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    uploading: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${styles[status]} uppercase tracking-wide`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
};

// ─── In-progress card ──────────────────────────────────────────────────────────

const ActiveCard = ({ job }: { job: GenerationJobRow }) => {
  const total = job.sceneProgress?.total ?? 0;
  const done = job.sceneProgress?.done ?? 0;
  const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400 flex-shrink-0">
            {job.queue === "edit" ? (
              <Pencil className="w-4 h-4" />
            ) : (
              <Film className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {job.prompt || "(untitled generation)"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Started {timeAgo(job.startedAt ?? job.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{STATUS_LABEL[job.status]}</span>
          <span className="text-white font-medium">
            {total > 0 ? `${done}/${total} scenes` : "Preparing…"}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500/70 rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? pct : 8}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Recent row ─────────────────────────────────────────────────────────────────

const RecentCard = ({ job }: { job: GenerationJobRow }) => {
  const isComplete = job.status === "complete";
  const isFailed = job.status === "failed";

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
            {isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : isFailed ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Clapperboard className="w-4 h-4 text-zinc-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {job.prompt || "(untitled generation)"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {job.queue === "edit" ? "Edit" : "Generation"} ·{" "}
              {timeAgo(job.completedAt ?? job.updatedAt ?? job.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {isComplete && job.finalUrl && (
        <a
          href={job.finalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors ml-12"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View video
        </a>
      )}

      {isFailed && job.error && (
        <p className="text-xs text-red-400/80 ml-12 break-words line-clamp-2">
          {job.error}
        </p>
      )}
    </div>
  );
};

// ─── Skeleton ───────────────────────────────────────────────────────────────────

const SkeletonRows = ({ count = 2 }: { count?: number }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <div
        key={i}
        className="h-20 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse"
      />
    ))}
  </div>
);

// ─── Main panel ─────────────────────────────────────────────────────────────────

const Generations = () => {
  const [active, setActive] = useState<GenerationJobRow[]>([]);
  const [recent, setRecent] = useState<GenerationJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    setError(null);
    try {
      const [activeRes, recentRes] = await Promise.all([
        api.get<{ success: boolean; data: GenerationJobRow[] }>(
          "/generatechat/jobs?status=active&limit=25"
        ),
        api.get<{ success: boolean; data: GenerationJobRow[] }>(
          "/generatechat/jobs?status=recent&limit=25"
        ),
      ]);
      setActive(activeRes.data?.data ?? []);
      setRecent(recentRes.data?.data ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load generation history";
      setError(message);
    } finally {
      setIsLoading(false);
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Live updates: bump an in-progress row's scene progress / status when a
  // matching chat_update event arrives. On any terminal event, re-fetch so the
  // job moves from "In Progress" to "Recent" with its final URL/error.
  useEffect(() => {
    interface ProgressEvent {
      type: string;
      data?: { sceneCount?: number } | null;
    }
    interface ChatUpdatePayload {
      chatId?: string;
      event?: ProgressEvent;
    }

    const handleUpdate = (payload: ChatUpdatePayload) => {
      const chatId = payload?.chatId;
      const type = payload?.event?.type;
      if (!chatId || !type) return;

      // Terminal transitions: refresh so the row re-buckets with final state.
      if (
        type === "job_complete" ||
        type === "job_failed" ||
        type === "edit_complete" ||
        type === "edit_failed"
      ) {
        fetchJobs();
        return;
      }

      setActive((prev) => {
        let changed = false;
        const next = prev.map((job) => {
          if (job.chatId !== chatId) return job;
          changed = true;
          if (type === "plan_complete") {
            const total =
              payload.event?.data?.sceneCount ?? job.sceneProgress.total;
            return {
              ...job,
              status: "rendering" as JobStatus,
              sceneProgress: { ...job.sceneProgress, total },
            };
          }
          if (type === "scene_render_complete" || type === "edit_render_complete") {
            return {
              ...job,
              sceneProgress: {
                ...job.sceneProgress,
                done: job.sceneProgress.done + 1,
              },
            };
          }
          if (type === "concat_started") {
            return { ...job, status: "concatenating" as JobStatus };
          }
          if (type === "planning" || type === "edit_started") {
            return { ...job, status: "planning" as JobStatus };
          }
          return job;
        });
        return changed ? next : prev;
      });
    };

    socket.on("chat_update", handleUpdate);
    return () => {
      socket.off("chat_update", handleUpdate);
    };
  }, [fetchJobs]);

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-10">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Generations
          </h1>
          <button
            onClick={() => fetchJobs(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-full px-3 py-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* In Progress */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            In Progress
          </h2>
          {isLoading ? (
            <SkeletonRows count={1} />
          ) : active.length === 0 ? (
            <p className="text-sm text-zinc-600 py-4">
              No generations are currently running.
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((job) => (
                <ActiveCard key={job._id} job={job} />
              ))}
            </div>
          )}
        </section>

        {/* Recent */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Recent
          </h2>
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-zinc-800">
                <Clapperboard className="w-8 h-8 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">
                  No past generations yet
                </h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-1">
                  Your completed and failed generations will show up here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((job) => (
                <RecentCard key={job._id} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Generations;
