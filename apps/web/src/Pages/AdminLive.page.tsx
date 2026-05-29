/**
 * /admin/live — internal "god view" dashboard (OBSERVABILITY §5).
 *
 * Watches ALL in-flight generation + edit jobs in real time:
 *   - GET /admin/live/jobs seeds the grid on mount (active + waiting jobs).
 *   - The Socket.IO `admin:live` firehose (joined via `join_admin_live`) keeps
 *     it live: every pipeline event for every job streams in as `admin_update`.
 *
 * Each job card shows: truncated prompt, a horizontal step timeline with the
 * current step highlighted + a per-step running elapsed timer (derived purely
 * from event `ts` deltas), and a row of scene thumbnails that turn green on
 * `scene_render_complete` / red on `scene_failed`.
 *
 * Server-side is the real gate (auth + requireAdmin). The UI shows a notice when
 * the firehose join is denied, but does not itself enforce access.
 *
 * SCOPE: uses the existing event granularity (step + per-scene completion). A
 * finer intra-render progress bar is intentionally NOT built here.
 * TODO: when the backend emits the planned `scene_render_progress` event, drive
 * a per-scene live percentage bar from it instead of the binary states below.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "@/socket";
import api from "@/api";

// ─── Backend event vocabulary (mirrors eventPublisher.util.ts) ─────────────────

type ProgressEventType =
    | "job_queued"
    | "planning"
    | "plan_complete"
    | "scene_started"
    | "scene_code_complete"
    | "scene_render_complete"
    | "scene_failed"
    | "concat_started"
    | "job_complete"
    | "job_failed"
    | "edit_started"
    | "edit_render_complete"
    | "edit_complete"
    | "edit_failed";

interface ProgressEvent {
    type: ProgressEventType;
    phase: string;
    data?: Record<string, unknown> | null;
    ts?: string;
}

interface AdminUpdate {
    chatId: string;
    event: ProgressEvent;
}

interface LiveJobSnapshot {
    queue: string;
    jobId: string;
    chatId: string;
    userId: string;
    prompt: string;
    state: string;
    attemptsMade: number;
    timestamp: number | null;
    processedOn: number | null;
    traceId?: string;
}

// ─── Pipeline step model ───────────────────────────────────────────────────────

type StepKey = "rag_enhance" | "plan" | "scenes" | "concat" | "upload";
type StepStatus = "pending" | "active" | "done" | "failed";

const STEP_ORDER: { key: StepKey; label: string }[] = [
    { key: "rag_enhance", label: "RAG" },
    { key: "plan", label: "Plan" },
    { key: "scenes", label: "Scenes" },
    { key: "concat", label: "Concat" },
    { key: "upload", label: "Upload" },
];

type SceneStatus = "rendering" | "done" | "failed";
interface SceneCell {
    index: number;
    status: SceneStatus;
    url?: string;
    error?: string;
}

interface JobCard {
    chatId: string;
    jobId?: string;
    queue: string;
    prompt: string;
    userId?: string;
    /** Current pipeline step. */
    currentStep: StepKey | null;
    /** Per-step status. */
    steps: Record<StepKey, StepStatus>;
    /** Epoch ms the current step started (for the running elapsed timer). */
    stepStartedAt: number;
    /** Total scenes once planning completes (null until known). */
    sceneCount: number | null;
    /** Scenes keyed by index. */
    scenes: Record<number, SceneCell>;
    /** Terminal state of the whole job. */
    terminal: "complete" | "failed" | null;
    lastEventAt: number;
    isEdit: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function emptySteps(): Record<StepKey, StepStatus> {
    return { rag_enhance: "pending", plan: "pending", scenes: "pending", concat: "pending", upload: "pending" };
}

function newCardFromSnapshot(s: LiveJobSnapshot): JobCard {
    const isEdit = s.queue === "video-edit";
    return {
        chatId: s.chatId,
        jobId: s.jobId,
        queue: s.queue,
        prompt: s.prompt || "(no prompt)",
        userId: s.userId,
        currentStep: s.processedOn ? "rag_enhance" : null,
        steps: emptySteps(),
        stepStartedAt: s.processedOn ?? s.timestamp ?? Date.now(),
        sceneCount: null,
        scenes: {},
        terminal: null,
        lastEventAt: s.processedOn ?? s.timestamp ?? Date.now(),
        isEdit,
    };
}

function newCardFromEvent(chatId: string, ev: ProgressEvent): JobCard {
    const isEdit = ev.type.startsWith("edit_");
    return {
        chatId,
        queue: isEdit ? "video-edit" : "video-generation",
        prompt: "(streaming — no snapshot)",
        currentStep: null,
        steps: emptySteps(),
        stepStartedAt: ev.ts ? Date.parse(ev.ts) : Date.now(),
        sceneCount: null,
        scenes: {},
        terminal: null,
        lastEventAt: ev.ts ? Date.parse(ev.ts) : Date.now(),
        isEdit,
    };
}

/** Advance a step to `active`, marking all earlier steps `done`. */
function activateStep(card: JobCard, key: StepKey, ts: number): JobCard {
    const idx = STEP_ORDER.findIndex((s) => s.key === key);
    const steps = { ...card.steps };
    STEP_ORDER.forEach((s, i) => {
        if (i < idx && steps[s.key] === "pending") steps[s.key] = "done";
    });
    if (steps[key] !== "done") steps[key] = "active";
    const changingStep = card.currentStep !== key;
    return {
        ...card,
        steps,
        currentStep: key,
        stepStartedAt: changingStep ? ts : card.stepStartedAt,
        lastEventAt: ts,
    };
}

/**
 * Apply a single progress event to a job card, returning the updated card.
 * Pure function so the reducer in setCards stays simple.
 */
function applyEvent(card: JobCard, ev: ProgressEvent): JobCard {
    const ts = ev.ts ? Date.parse(ev.ts) : Date.now();
    const data = (ev.data ?? {}) as Record<string, unknown>;

    switch (ev.type) {
        case "job_queued":
            return { ...card, lastEventAt: ts };

        case "planning":
            // phase is "rag_enhance" or "agent_plan"
            if (ev.phase === "agent_plan") return activateStep(card, "plan", ts);
            return activateStep(card, "rag_enhance", ts);

        case "plan_complete": {
            const next = activateStep(card, "scenes", ts);
            const n = typeof data.sceneCount === "number" ? data.sceneCount : next.sceneCount;
            return { ...next, sceneCount: n, steps: { ...next.steps, plan: "done" } };
        }

        case "scene_started": {
            const i = typeof data.index === "number" ? data.index : 0;
            const next = activateStep(card, "scenes", ts);
            return {
                ...next,
                scenes: { ...next.scenes, [i]: { index: i, status: "rendering" } },
            };
        }

        case "scene_code_complete": {
            const i = typeof data.index === "number" ? data.index : 0;
            const existing = card.scenes[i] ?? { index: i, status: "rendering" as SceneStatus };
            return {
                ...card,
                lastEventAt: ts,
                scenes: { ...card.scenes, [i]: { ...existing, status: "rendering" } },
            };
        }

        case "scene_render_complete": {
            const i = typeof data.index === "number" ? data.index : 0;
            const url = typeof data.url === "string" ? data.url : undefined;
            return {
                ...card,
                lastEventAt: ts,
                scenes: { ...card.scenes, [i]: { index: i, status: "done", url } },
            };
        }

        case "scene_failed": {
            const i = typeof data.index === "number" ? data.index : 0;
            const error = typeof data.error === "string" ? data.error : "failed";
            return {
                ...card,
                lastEventAt: ts,
                scenes: { ...card.scenes, [i]: { index: i, status: "failed", error } },
            };
        }

        case "concat_started": {
            const next = activateStep(card, "concat", ts);
            return { ...next, steps: { ...next.steps, scenes: "done" } };
        }

        case "job_complete": {
            const steps = { ...card.steps };
            (Object.keys(steps) as StepKey[]).forEach((k) => (steps[k] = "done"));
            return { ...card, steps, currentStep: "upload", terminal: "complete", lastEventAt: ts };
        }

        case "job_failed": {
            const steps = { ...card.steps };
            if (card.currentStep) steps[card.currentStep] = "failed";
            return { ...card, steps, terminal: "failed", lastEventAt: ts };
        }

        // ── Edit pipeline (simpler: load → rag → code → render → done) ───────
        case "edit_started": {
            if (ev.phase === "render") return activateStep(card, "scenes", ts);
            if (ev.phase === "rag_enhance") return activateStep(card, "rag_enhance", ts);
            if (ev.phase === "agent_code") return activateStep(card, "plan", ts);
            return { ...card, lastEventAt: ts };
        }

        case "edit_render_complete": {
            const url = typeof data.url === "string" ? data.url : undefined;
            const next = activateStep(card, "concat", ts);
            return {
                ...next,
                scenes: { ...next.scenes, 0: { index: 0, status: "done", url } },
            };
        }

        case "edit_complete": {
            const steps = { ...card.steps };
            (Object.keys(steps) as StepKey[]).forEach((k) => (steps[k] = "done"));
            return { ...card, steps, currentStep: "upload", terminal: "complete", lastEventAt: ts };
        }

        case "edit_failed": {
            const steps = { ...card.steps };
            if (card.currentStep) steps[card.currentStep] = "failed";
            return { ...card, steps, terminal: "failed", lastEventAt: ts };
        }

        default:
            return { ...card, lastEventAt: ts };
    }
}

// ─── Tick hook: re-render every second so elapsed timers advance ──────────────

function useSecondTick(enabled: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!enabled) return;
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [enabled]);
    return now;
}

function fmtElapsed(ms: number): string {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
}

// ─── Presentational pieces ─────────────────────────────────────────────────────

function StepTimeline({ card, now }: { card: JobCard; now: number }) {
    return (
        <div className="flex items-center gap-1 mt-3">
            {STEP_ORDER.map((step, i) => {
                const status = card.steps[step.key];
                const isCurrent = card.currentStep === step.key && !card.terminal;
                const color =
                    status === "done"
                        ? "bg-emerald-600 text-emerald-50 border-emerald-500"
                        : status === "failed"
                        ? "bg-red-700 text-red-50 border-red-500"
                        : status === "active"
                        ? "bg-amber-600 text-amber-50 border-amber-400 animate-pulse"
                        : "bg-zinc-800 text-zinc-500 border-zinc-700";
                return (
                    <div key={step.key} className="flex items-center">
                        <div
                            className={`px-2 py-1 rounded-md border text-[10px] font-medium whitespace-nowrap ${color}`}
                            title={step.key}
                        >
                            {step.label}
                            {isCurrent && (
                                <span className="ml-1 tabular-nums opacity-90">
                                    {fmtElapsed(now - card.stepStartedAt)}
                                </span>
                            )}
                        </div>
                        {i < STEP_ORDER.length - 1 && (
                            <div className="w-2 h-px bg-zinc-700 mx-0.5" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SceneThumbnails({ card }: { card: JobCard }) {
    const indices = useMemo(() => {
        const known = Object.keys(card.scenes).map(Number);
        const max = Math.max(
            card.sceneCount ?? 0,
            known.length ? Math.max(...known) + 1 : 0
        );
        return Array.from({ length: max }, (_, i) => i);
    }, [card.scenes, card.sceneCount]);

    if (indices.length === 0) {
        return <div className="mt-3 text-[11px] text-zinc-600">No scenes yet…</div>;
    }

    return (
        <div className="mt-3 flex flex-wrap gap-1.5">
            {indices.map((i) => {
                const cell = card.scenes[i];
                const status = cell?.status;
                const ring =
                    status === "done"
                        ? "ring-emerald-500"
                        : status === "failed"
                        ? "ring-red-500"
                        : status === "rendering"
                        ? "ring-amber-500 animate-pulse"
                        : "ring-zinc-700";
                return (
                    <div
                        key={i}
                        title={
                            status === "failed"
                                ? `Scene ${i + 1}: ${cell?.error ?? "failed"}`
                                : `Scene ${i + 1}: ${status ?? "pending"}`
                        }
                        className={`relative w-12 h-9 rounded-sm overflow-hidden bg-zinc-900 ring-2 ${ring} flex items-center justify-center`}
                    >
                        {cell?.url && status === "done" ? (
                            <img
                                src={cell.url}
                                alt={`scene ${i + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <span className="text-[9px] text-zinc-500">{i + 1}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function JobCardView({ card, now }: { card: JobCard; now: number }) {
    const border =
        card.terminal === "failed"
            ? "border-red-800"
            : card.terminal === "complete"
            ? "border-emerald-800"
            : "border-zinc-800";
    const doneScenes = Object.values(card.scenes).filter((s) => s.status === "done").length;
    return (
        <div className={`rounded-xl border ${border} bg-zinc-900/60 p-4 flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {card.isEdit ? "edit" : "gen"}
                </span>
                <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                        card.terminal === "failed"
                            ? "bg-red-900/60 text-red-300"
                            : card.terminal === "complete"
                            ? "bg-emerald-900/60 text-emerald-300"
                            : "bg-amber-900/40 text-amber-300"
                    }`}
                >
                    {card.terminal ?? "running"}
                </span>
            </div>

            <p className="mt-2 text-sm text-zinc-200 line-clamp-2" title={card.prompt}>
                {card.prompt}
            </p>

            <StepTimeline card={card} now={now} />
            <SceneThumbnails card={card} />

            <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>chat {card.chatId.slice(-6)}</span>
                <span>
                    {doneScenes}
                    {card.sceneCount != null ? `/${card.sceneCount}` : ""} scenes
                </span>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const AdminLivePage = () => {
    const [cards, setCards] = useState<Record<string, JobCard>>({});
    const [status, setStatus] = useState<"connecting" | "live" | "denied" | "error">("connecting");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const joinedRef = useRef(false);

    const cardList = useMemo(
        () => Object.values(cards).sort((a, b) => b.lastEventAt - a.lastEventAt),
        [cards]
    );
    const hasRunning = cardList.some((c) => !c.terminal);
    const now = useSecondTick(hasRunning);

    // Seed + subscribe.
    useEffect(() => {
        let cancelled = false;

        // 1. Seed from REST snapshot.
        (async () => {
            try {
                const res = await api.get<{ jobs: LiveJobSnapshot[] }>("/admin/live/jobs");
                if (cancelled) return;
                const seeded: Record<string, JobCard> = {};
                for (const s of res.data.jobs ?? []) {
                    if (s.chatId) seeded[s.chatId] = newCardFromSnapshot(s);
                }
                setCards((prev) => ({ ...seeded, ...prev }));
            } catch (err) {
                if (cancelled) return;
                const code = (err as { response?: { status?: number } })?.response?.status;
                if (code === 403 || code === 404) {
                    setStatus("denied");
                    setErrorMsg("Admin access required (server-side gate).");
                } else {
                    setStatus("error");
                    setErrorMsg("Failed to load job snapshot.");
                }
            }
        })();

        // 2. Connect socket + join the admin firehose room.
        if (!socket.connected) socket.connect();

        const tryJoin = () => {
            if (joinedRef.current) return;
            joinedRef.current = true;
            socket.emit("join_admin_live");
        };

        const onJoined = () => setStatus("live");
        const onDenied = (payload: { message?: string }) => {
            setStatus("denied");
            setErrorMsg(payload?.message ?? "Admin access required.");
        };
        const onUpdate = (payload: AdminUpdate) => {
            const { chatId, event } = payload ?? {};
            if (!chatId || !event || typeof event !== "object") return;
            setCards((prev) => {
                const existing = prev[chatId] ?? newCardFromEvent(chatId, event);
                return { ...prev, [chatId]: applyEvent(existing, event) };
            });
        };

        socket.on("connect", tryJoin);
        socket.on("admin_live_joined", onJoined);
        socket.on("admin_live_denied", onDenied);
        socket.on("admin_update", onUpdate);
        if (socket.connected) tryJoin();

        return () => {
            cancelled = true;
            socket.off("connect", tryJoin);
            socket.off("admin_live_joined", onJoined);
            socket.off("admin_live_denied", onDenied);
            socket.off("admin_update", onUpdate);
            joinedRef.current = false;
        };
    }, []);

    const runningCount = cardList.filter((c) => !c.terminal).length;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight text-emerald-400">
                        Stitcher · Live God View
                    </h1>
                    <p className="text-[11px] text-zinc-500">
                        Real-time view of every in-flight generation &amp; edit job.
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span
                        className={`inline-flex items-center gap-1.5 ${
                            status === "live"
                                ? "text-emerald-400"
                                : status === "denied" || status === "error"
                                ? "text-red-400"
                                : "text-amber-400"
                        }`}
                    >
                        <span
                            className={`w-2 h-2 rounded-full ${
                                status === "live"
                                    ? "bg-emerald-500 animate-pulse"
                                    : status === "denied" || status === "error"
                                    ? "bg-red-500"
                                    : "bg-amber-500 animate-pulse"
                            }`}
                        />
                        {status}
                    </span>
                    <span className="text-zinc-500">{runningCount} running</span>
                </div>
            </header>

            <main className="px-6 py-6">
                {(status === "denied" || status === "error") && (
                    <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                        {errorMsg ?? "Unavailable."}
                    </div>
                )}

                {cardList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-zinc-600">
                        <p className="text-sm">No active jobs.</p>
                        <p className="text-xs mt-1">
                            Cards will appear here as generations start streaming events.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {cardList.map((card) => (
                            <JobCardView key={card.chatId} card={card} now={now} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminLivePage;
