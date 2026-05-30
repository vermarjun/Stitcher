/**
 * /admin/live — Real-time god-view of all in-flight generation + edit jobs.
 *
 * Data flow:
 *   1. GET /admin/live/jobs (via useAdminQuery) seeds the grid on mount.
 *   2. Socket.IO admin firehose: emit `join_admin_live`, then listen to:
 *        admin_live_joined  → set status = "live"
 *        admin_live_denied  → set status = "denied" + show message
 *        admin_update       → merge { chatId, event } into the live job map
 *   3. A single 1-second interval drives elapsed-time display for running jobs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Radio,
  Timer,
  XCircle,
} from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { socket } from '@/lib/socket';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { LiveJobSnapshot, LiveJobsResponse } from '@/lib/types';
import { formatDuration } from '@/lib/format';

// ─── Backend progress event vocabulary ────────────────────────────────────────

type ProgressEventType =
  | 'job_queued'
  | 'planning'
  | 'plan_complete'
  | 'scene_started'
  | 'scene_code_complete'
  | 'scene_render_complete'
  | 'scene_failed'
  | 'concat_started'
  | 'job_complete'
  | 'job_failed'
  | 'edit_started'
  | 'edit_render_complete'
  | 'edit_complete'
  | 'edit_failed';

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

// ─── Internal job card model ───────────────────────────────────────────────────

type StepKey = 'rag_enhance' | 'plan' | 'scenes' | 'concat' | 'upload';
type StepStatus = 'pending' | 'active' | 'done' | 'failed';
type SceneStatus = 'rendering' | 'done' | 'failed';

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
  status: string;
  currentStep: StepKey | null;
  steps: Record<StepKey, StepStatus>;
  stepStartedAt: number;
  sceneCount: number | null;
  scenes: Record<number, SceneCell>;
  terminal: 'complete' | 'failed' | null;
  lastEventAt: number;
  startedAt: number;
  isEdit: boolean;
}

// ─── Pipeline step order ───────────────────────────────────────────────────────

const STEP_ORDER: { key: StepKey; label: string }[] = [
  { key: 'rag_enhance', label: 'RAG' },
  { key: 'plan', label: 'Plan' },
  { key: 'scenes', label: 'Scenes' },
  { key: 'concat', label: 'Concat' },
  { key: 'upload', label: 'Upload' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function emptySteps(): Record<StepKey, StepStatus> {
  return {
    rag_enhance: 'pending',
    plan: 'pending',
    scenes: 'pending',
    concat: 'pending',
    upload: 'pending',
  };
}

function newCardFromSnapshot(s: LiveJobSnapshot): JobCard {
  const isEdit = s.queue === 'video-edit';
  const startedMs = s.processedOn ?? s.timestamp ?? Date.now();
  return {
    chatId: s.chatId,
    jobId: s.jobId,
    queue: s.queue,
    prompt: s.prompt || '(no prompt)',
    userId: s.userId,
    status: s.state,
    currentStep: s.processedOn ? 'rag_enhance' : null,
    steps: emptySteps(),
    stepStartedAt: startedMs,
    sceneCount: null,
    scenes: {},
    terminal: null,
    lastEventAt: startedMs,
    startedAt: startedMs,
    isEdit,
  };
}

function newCardFromEvent(chatId: string, ev: ProgressEvent): JobCard {
  const isEdit = ev.type.startsWith('edit_');
  const now = ev.ts ? Date.parse(ev.ts) : Date.now();
  return {
    chatId,
    queue: isEdit ? 'edit' : 'generation',
    prompt: '(streaming — no snapshot)',
    status: 'rendering',
    currentStep: null,
    steps: emptySteps(),
    stepStartedAt: now,
    sceneCount: null,
    scenes: {},
    terminal: null,
    lastEventAt: now,
    startedAt: now,
    isEdit,
  };
}

/** Advance a step to `active`, marking all earlier steps `done`. */
function activateStep(card: JobCard, key: StepKey, ts: number): JobCard {
  const idx = STEP_ORDER.findIndex((s) => s.key === key);
  const steps = { ...card.steps };
  STEP_ORDER.forEach((s, i) => {
    if (i < idx && steps[s.key] === 'pending') steps[s.key] = 'done';
  });
  if (steps[key] !== 'done') steps[key] = 'active';
  const changingStep = card.currentStep !== key;
  return {
    ...card,
    steps,
    currentStep: key,
    stepStartedAt: changingStep ? ts : card.stepStartedAt,
    lastEventAt: ts,
  };
}

/** Apply a single progress event to a job card. Pure function. */
function applyEvent(card: JobCard, ev: ProgressEvent): JobCard {
  const ts = ev.ts ? Date.parse(ev.ts) : Date.now();
  const data = (ev.data ?? {}) as Record<string, unknown>;

  switch (ev.type) {
    case 'job_queued':
      return { ...card, status: 'queued', lastEventAt: ts };

    case 'planning':
      if (ev.phase === 'agent_plan') return { ...activateStep(card, 'plan', ts), status: 'planning' };
      return { ...activateStep(card, 'rag_enhance', ts), status: 'planning' };

    case 'plan_complete': {
      const next = activateStep(card, 'scenes', ts);
      const n = typeof data.sceneCount === 'number' ? data.sceneCount : next.sceneCount;
      return { ...next, sceneCount: n, steps: { ...next.steps, plan: 'done' }, status: 'rendering' };
    }

    case 'scene_started': {
      const i = typeof data.index === 'number' ? data.index : 0;
      const next = activateStep(card, 'scenes', ts);
      return {
        ...next,
        status: 'rendering',
        scenes: { ...next.scenes, [i]: { index: i, status: 'rendering' } },
      };
    }

    case 'scene_code_complete': {
      const i = typeof data.index === 'number' ? data.index : 0;
      const existing = card.scenes[i] ?? { index: i, status: 'rendering' as SceneStatus };
      return {
        ...card,
        lastEventAt: ts,
        scenes: { ...card.scenes, [i]: { ...existing, status: 'rendering' } },
      };
    }

    case 'scene_render_complete': {
      const i = typeof data.index === 'number' ? data.index : 0;
      const url = typeof data.url === 'string' ? data.url : undefined;
      return {
        ...card,
        lastEventAt: ts,
        scenes: { ...card.scenes, [i]: { index: i, status: 'done', url } },
      };
    }

    case 'scene_failed': {
      const i = typeof data.index === 'number' ? data.index : 0;
      const error = typeof data.error === 'string' ? data.error : 'failed';
      return {
        ...card,
        lastEventAt: ts,
        scenes: { ...card.scenes, [i]: { index: i, status: 'failed', error } },
      };
    }

    case 'concat_started': {
      const next = activateStep(card, 'concat', ts);
      return { ...next, status: 'concatenating', steps: { ...next.steps, scenes: 'done' } };
    }

    case 'job_complete': {
      const steps = { ...card.steps };
      (Object.keys(steps) as StepKey[]).forEach((k) => (steps[k] = 'done'));
      return { ...card, steps, currentStep: 'upload', terminal: 'complete', status: 'complete', lastEventAt: ts };
    }

    case 'job_failed': {
      const steps = { ...card.steps };
      if (card.currentStep) steps[card.currentStep] = 'failed';
      return { ...card, steps, terminal: 'failed', status: 'failed', lastEventAt: ts };
    }

    // ── Edit pipeline ─────────────────────────────────────────────────────────
    case 'edit_started': {
      if (ev.phase === 'render') return { ...activateStep(card, 'scenes', ts), status: 'rendering' };
      if (ev.phase === 'rag_enhance') return { ...activateStep(card, 'rag_enhance', ts), status: 'planning' };
      if (ev.phase === 'agent_code') return { ...activateStep(card, 'plan', ts), status: 'planning' };
      return { ...card, lastEventAt: ts };
    }

    case 'edit_render_complete': {
      const url = typeof data.url === 'string' ? data.url : undefined;
      const next = activateStep(card, 'concat', ts);
      return {
        ...next,
        status: 'concatenating',
        scenes: { ...next.scenes, 0: { index: 0, status: 'done', url } },
      };
    }

    case 'edit_complete': {
      const steps = { ...card.steps };
      (Object.keys(steps) as StepKey[]).forEach((k) => (steps[k] = 'done'));
      return { ...card, steps, currentStep: 'upload', terminal: 'complete', status: 'complete', lastEventAt: ts };
    }

    case 'edit_failed': {
      const steps = { ...card.steps };
      if (card.currentStep) steps[card.currentStep] = 'failed';
      return { ...card, steps, terminal: 'failed', status: 'failed', lastEventAt: ts };
    }

    default:
      return { ...card, lastEventAt: ts };
  }
}

// ─── Elapsed display ───────────────────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  return formatDuration(ms);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StepPip({
  status,
  label,
  isCurrent,
  elapsedMs,
}: {
  status: StepStatus;
  label: string;
  isCurrent: boolean;
  elapsedMs: number;
}) {
  const base = 'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors';
  const color =
    status === 'done'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : status === 'failed'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : status === 'active'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
      : 'bg-muted/20 text-muted-foreground border-muted/20';

  return (
    <span className={`${base} ${color}`} title={status}>
      {label}
      {isCurrent && status === 'active' && (
        <span className="tabular-nums opacity-80">{fmtElapsed(elapsedMs)}</span>
      )}
    </span>
  );
}

function JobCardView({ card, now }: { card: JobCard; now: number }) {
  const doneScenes = Object.values(card.scenes).filter((s) => s.status === 'done').length;
  const totalScenes = card.sceneCount ?? Object.keys(card.scenes).length;
  const scenePercent = totalScenes > 0 ? Math.round((doneScenes / totalScenes) * 100) : 0;
  const elapsedMs = now - card.startedAt;

  const borderColor =
    card.terminal === 'failed'
      ? 'border-red-800/50'
      : card.terminal === 'complete'
      ? 'border-emerald-800/50'
      : 'border-border';

  const queueLabel = card.isEdit ? 'edit' : 'gen';

  return (
    <Card className={`flex flex-col gap-0 border ${borderColor} bg-card overflow-hidden`}>
      <CardHeader className="pb-2 pt-4 px-4">
        {/* top row: queue tag + status badge + elapsed */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
            {queueLabel}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <StatusBadge status={card.status} />
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
              <Timer className="h-3 w-3" />
              {fmtElapsed(elapsedMs)}
            </span>
          </div>
        </div>

        {/* prompt */}
        <p
          className="mt-2 text-sm font-medium text-foreground line-clamp-2 leading-snug"
          title={card.prompt}
        >
          {card.prompt}
        </p>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        {/* Step pills */}
        <div className="flex flex-wrap gap-1">
          {STEP_ORDER.map((step) => (
            <StepPip
              key={step.key}
              status={card.steps[step.key]}
              label={step.label}
              isCurrent={card.currentStep === step.key && !card.terminal}
              elapsedMs={now - card.stepStartedAt}
            />
          ))}
        </div>

        {/* Scene progress bar — only shown once we know scene count */}
        {totalScenes > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Scenes</span>
              <span className="tabular-nums">
                {doneScenes}/{totalScenes}
              </span>
            </div>
            <Progress
              value={scenePercent}
              className="h-1.5"
            />
          </div>
        )}

        {/* Footer: userId + chatId */}
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/70 gap-2 mt-auto">
          <span title={card.userId} className="truncate max-w-[50%]">
            user {card.userId ? card.userId.slice(-6) : '—'}
          </span>
          <span title={card.chatId} className="truncate max-w-[50%] text-right">
            chat {card.chatId.slice(-6)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function JobCardSkeleton() {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex gap-1">
          {STEP_ORDER.map((s) => (
            <Skeleton key={s.key} className="h-5 w-12" />
          ))}
        </div>
        <Skeleton className="h-1.5 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Connection indicator ──────────────────────────────────────────────────────

type LiveStatus = 'connecting' | 'live' | 'denied' | 'error';

function ConnectionBadge({ status }: { status: LiveStatus }) {
  const configs: Record<LiveStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    connecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Connecting',
      cls: 'text-amber-500',
    },
    live: {
      icon: <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />,
      label: 'Live',
      cls: 'text-emerald-500',
    },
    denied: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Denied',
      cls: 'text-red-500',
    },
    error: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Error',
      cls: 'text-red-500',
    },
  };

  const c = configs[status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LivePage() {
  const [cards, setCards] = useState<Record<string, JobCard>>({});
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const [deniedMsg, setDeniedMsg] = useState<string | null>(null);
  const joinedRef = useRef(false);

  // 1. Seed from REST snapshot
  const { data, isLoading } = useAdminQuery<LiveJobsResponse>('live-jobs', '/admin/live/jobs');

  useEffect(() => {
    if (!data?.jobs) return;
    setCards((prev) => {
      const seeded: Record<string, JobCard> = {};
      for (const s of data.jobs) {
        if (s.chatId) seeded[s.chatId] = newCardFromSnapshot(s);
      }
      // Don't clobber cards that already got live updates
      return { ...seeded, ...prev };
    });
  }, [data]);

  // 2. Socket wiring
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const tryJoin = () => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      socket.emit('join_admin_live');
    };

    const onJoined = () => setLiveStatus('live');

    const onDenied = (payload: { message?: string }) => {
      setLiveStatus('denied');
      setDeniedMsg(payload?.message ?? 'Admin access required.');
    };

    const onUpdate = (payload: AdminUpdate) => {
      const { chatId, event } = payload ?? {};
      if (!chatId || !event || typeof event !== 'object') return;
      setCards((prev) => {
        const existing = prev[chatId] ?? newCardFromEvent(chatId, event);
        const updated = applyEvent(existing, event);
        return { ...prev, [chatId]: updated };
      });
    };

    socket.on('connect', tryJoin);
    socket.on('admin_live_joined', onJoined);
    socket.on('admin_live_denied', onDenied);
    socket.on('admin_update', onUpdate);

    if (socket.connected) tryJoin();

    return () => {
      socket.off('connect', tryJoin);
      socket.off('admin_live_joined', onJoined);
      socket.off('admin_live_denied', onDenied);
      socket.off('admin_update', onUpdate);
      joinedRef.current = false;
    };
  }, []);

  // 3. Sorted card list
  const cardList = useMemo(
    () => Object.values(cards).sort((a, b) => b.lastEventAt - a.lastEventAt),
    [cards]
  );

  const runningCount = cardList.filter((c) => !c.terminal).length;
  const hasRunning = runningCount > 0;

  // 4. Single global tick for all elapsed displays (only while jobs are running)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  // 5. Auto-remove terminal jobs after a short delay
  useEffect(() => {
    const terminalIds = Object.entries(cards)
      .filter(([, c]) => c.terminal !== null)
      .map(([id]) => id);

    if (terminalIds.length === 0) return;

    const timers = terminalIds.map((id) =>
      window.setTimeout(() => {
        setCards((prev) => {
          const next = { ...prev };
          // Only remove if still terminal (no new event arrived)
          if (next[id]?.terminal !== null) delete next[id];
          return next;
        });
      }, 15_000)
    );

    return () => timers.forEach(window.clearTimeout);
  }, [cards]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader
        title="Live Jobs"
        description="Real-time view of every in-flight generation and edit job."
      >
        <div className="flex items-center gap-4">
          <ConnectionBadge status={liveStatus} />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{runningCount}</span>
            <span>running</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{cardList.length}</span>
            <span>total</span>
          </span>
        </div>
      </PageHeader>

      {/* Denied / error banner */}
      {(liveStatus === 'denied' || liveStatus === 'error') && deniedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {deniedMsg}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && cardList.length === 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && cardList.length === 0 && (
        <EmptyState
          title="No jobs running right now"
          description="Cards will appear here as generations and edits stream in via the admin firehose."
          icon={CheckCircle2}
        />
      )}

      {/* Job grid */}
      {cardList.length > 0 && (
        <ScrollArea className="flex-1 -mx-1">
          <div className="px-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4">
            {cardList.map((card) => (
              <JobCardView key={card.chatId} card={card} now={now} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Legend */}
      {cardList.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-500/40 border border-amber-500/30 animate-pulse" />
            Active step
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/30 border border-emerald-500/30" />
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-500/30 border border-red-500/30" />
            Failed
          </span>
          <span className="flex items-center gap-1.5">
            <CircleDashed className="h-3 w-3" />
            Pending
          </span>
          <span className="ml-auto">Terminal jobs auto-removed after 15s</span>
        </div>
      )}
    </div>
  );
}
