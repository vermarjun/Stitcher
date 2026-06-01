/**
 * GenerationDetail — per-job ticket timeline view (Phase 4.1)
 *
 * Route: /generation/:jobId
 * Reachable by clicking a row on the Generation list table.
 *
 * Renders:
 *  • Top-level summary KPIs (status, duration, tokens, cost, finalUrl)
 *  • Grafana / Langfuse deep-link buttons
 *  • Per-stage TIMELINE: each stage as a row with service, duration bar,
 *    status colour, tokens, model, outputSummary
 *  • For FAILED stages: prominent error message + collapsible failedCode block
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  DollarSign,
  Film,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Star,
  Check,
  X,
  Copy,
  Bug,
  Cpu,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatDuration, formatNumber, formatRelative } from '@/lib/format';
import type { JobDetailRlhf, JobStage, LlmIoEntry, RetrievalTrace, CurationStatus } from '@/lib/types';

// ── Env ───────────────────────────────────────────────────────────────────────

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3001';
const LANGFUSE_URL = import.meta.env.VITE_LANGFUSE_URL ?? 'http://localhost:3002';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUsd(v: number | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(v);
}

function grafanaTraceUrl(traceId: string): string {
  return `${GRAFANA_URL}/explore?left=${encodeURIComponent(
    JSON.stringify({ datasource: 'tempo', queries: [{ query: traceId }] })
  )}`;
}

function langfuseTraceUrl(traceId: string): string {
  return `${LANGFUSE_URL}/trace/${traceId}`;
}

const SERVICE_COLORS: Record<string, string> = {
  'stitcher-api': 'bg-indigo-500',
  'stitcher-rag': 'bg-amber-500',
  'stitcher-agent': 'bg-blue-500',
  'stitcher-render': 'bg-emerald-500',
};

const SERVICE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  'stitcher-api': 'default',
  'stitcher-rag': 'secondary',
  'stitcher-agent': 'default',
  'stitcher-render': 'secondary',
};

const STAGE_LABELS: Record<string, string> = {
  // RAG stages
  query_transform: 'Query Transform (RAG)',
  rag_enhance: 'RAG Retrieval',
  // Agent stages
  agent_plan: 'Agent Plan',
  agent_code: 'Code Generation',
  agent_debug: 'Debugger',
  // Render / infra
  render: 'Render',
  tts: 'TTS',
  concat: 'Concat',
  upload: 'Upload',
};

/** Ordering: RAG stages first, then agent/code/debug, then infra. */
const STAGE_ORDER: Record<string, number> = {
  query_transform: 0,
  rag_enhance: 1,
  agent_plan: 2,
  agent_code: 3,
  agent_debug: 4,
  render: 5,
  tts: 6,
  concat: 7,
  upload: 8,
};

function stageGroupSortKey(stage: string): number {
  return STAGE_ORDER[stage] ?? 99;
}

// ── FailedCodeBlock ───────────────────────────────────────────────────────────

function FailedCodeBlock({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {open ? 'Hide generated code' : 'Show generated code (failedCode)'}
      </button>
      {open && (
        <pre className="mt-2 rounded-md bg-muted/50 border border-border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
          {code}
        </pre>
      )}
    </div>
  );
}

// ── StageDurationBar ──────────────────────────────────────────────────────────

function StageDurationBar({
  durationMs,
  maxMs,
}: {
  durationMs: number;
  maxMs: number;
}) {
  const pct = maxMs > 0 ? Math.max(2, (durationMs / maxMs) * 100) : 2;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden w-24 shrink-0">
      <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── StageRow ──────────────────────────────────────────────────────────────────

function StageRow({ stage, maxMs }: { stage: JobStage; maxMs: number }) {
  const ok = stage.status === 'ok';
  const label = STAGE_LABELS[stage.stage] ?? stage.stage;
  const svcColor = SERVICE_COLORS[stage.service] ?? 'bg-gray-400';

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        ok ? 'border-border bg-background' : 'border-destructive/40 bg-destructive/5'
      }`}
    >
      {/* Top row: service dot, stage name, status, duration */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Service colour dot */}
        <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${svcColor}`} />

        {/* Stage label */}
        <span className="font-medium text-sm">{label}</span>

        {/* Scene index if present */}
        {stage.sceneIndex != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            scene {stage.sceneIndex}
          </Badge>
        )}

        {/* Service badge */}
        <Badge variant={SERVICE_BADGE_VARIANT[stage.service] ?? 'outline'} className="text-[10px]">
          {stage.service}
        </Badge>

        {/* Model badge if present */}
        {stage.model && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            {stage.model}
          </Badge>
        )}

        {/* Status */}
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        )}

        {/* Duration */}
        <div className="ml-auto flex items-center gap-2">
          <StageDurationBar durationMs={stage.durationMs} maxMs={maxMs} />
          <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">
            {formatDuration(stage.durationMs)}
          </span>
        </div>
      </div>

      {/* Tokens row (if present) */}
      {stage.tokens && (
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground pl-5">
          <span>
            <span className="font-medium text-foreground">
              {formatNumber(stage.tokens.total, true)}
            </span>{' '}
            tokens
          </span>
          <span>in {formatNumber(stage.tokens.input, true)}</span>
          <span>out {formatNumber(stage.tokens.output, true)}</span>
        </div>
      )}

      {/* Output summary (if present) */}
      {stage.outputSummary && (
        <p className="mt-1.5 text-xs text-muted-foreground pl-5 italic">
          {stage.outputSummary}
        </p>
      )}

      {/* FAILED: error + failedCode */}
      {!ok && (
        <div className="mt-3 pl-5">
          {stage.error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-mono whitespace-pre-wrap break-all">
                {stage.error}
              </p>
            </div>
          )}
          {stage.failedCode && <FailedCodeBlock code={stage.failedCode} />}
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64 rounded" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-48 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}

// ── RLHF helpers ──────────────────────────────────────────────────────────────

function RatingStarsDetail({ rating }: { rating: number | null }) {
  if (rating == null) {
    return <span className="text-xs text-muted-foreground italic">unrated</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-medium tabular-nums">{rating}/5</span>
    </div>
  );
}

function CurationControlsDetail({
  jobId,
  curationStatus,
}: {
  jobId: string;
  curationStatus: CurationStatus;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      api.post(`/admin/rlhf/generations/${jobId}/curate`, { decision }).then((r) => r.data),
    onSuccess: (_data, decision) => {
      toast.success(`Job ${decision === 'approve' ? 'approved' : 'rejected'}`);
      void qc.invalidateQueries({ queryKey: ['generation-detail', { jobId }] });
      void qc.invalidateQueries({ queryKey: ['generations-list'] });
    },
    onError: () => toast.error('Curation failed'),
  });

  const chipVariant =
    curationStatus === 'approved'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : curationStatus === 'rejected'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : 'bg-muted/40 text-muted-foreground border-border';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded border ${chipVariant} capitalize`}>
        {curationStatus}
      </span>
      <button
        type="button"
        disabled={mutation.isPending || curationStatus === 'approved'}
        onClick={() => mutation.mutate('approve')}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors
          ${curationStatus === 'approved'
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 cursor-default'
            : 'border-border text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40'
          }`}
      >
        <Check className="h-3.5 w-3.5" />
        Approve
      </button>
      <button
        type="button"
        disabled={mutation.isPending || curationStatus === 'rejected'}
        onClick={() => mutation.mutate('reject')}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors
          ${curationStatus === 'rejected'
            ? 'border-destructive/40 text-destructive bg-destructive/10 cursor-default'
            : 'border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive hover:bg-destructive/10 disabled:opacity-40'
          }`}
      >
        <X className="h-3.5 w-3.5" />
        Reject
      </button>
    </div>
  );
}

// ── LLM I/O viewer ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border hover:border-foreground/30"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ScrollableBlock({ content, label }: { content: string; label: string }) {
  const [open, setOpen] = useState(false);
  const isMemoryBlock = label === 'System prompt' && content.includes('PAST MISTAKES TO AVOID');
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span>{label}</span>
          {isMemoryBlock && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-400 border-violet-500/30">
              contains PAST MISTAKES block
            </span>
          )}
        </div>
        {open && (
          <span onClick={(e) => e.stopPropagation()}>
            <CopyButton text={content} />
          </span>
        )}
      </button>
      {open && (
        <pre className="text-xs font-mono p-3 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all bg-muted/10"
          style={{ maxHeight: '16rem' }}>
          {content}
        </pre>
      )}
    </div>
  );
}

// ── RAG Retrieval Panel ───────────────────────────────────────────────────────

const CANDIDATE_CAP = 20;

function CandidateTable({
  label,
  rows,
  selectedIds,
}: {
  label: string;
  rows: Array<{ id: string; title: string; score: number }>;
  selectedIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const visible = rows.slice(0, CANDIDATE_CAP);
  const overflow = rows.length - CANDIDATE_CAP;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span>{label}</span>
          <span className="text-[10px] text-muted-foreground">({rows.length})</span>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-border bg-muted/20">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-6"></th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-40">ID</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Title</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground w-20">Score</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-border/50 ${isSelected ? 'bg-emerald-500/8' : ''}`}
                  >
                    <td className="px-3 py-1.5 text-center">
                      {isSelected && (
                        <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground truncate max-w-[10rem]">
                      {row.id}
                    </td>
                    <td className={`px-3 py-1.5 ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {row.title}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.score.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
              {overflow > 0 && (
                <tr className="border-t border-border/50">
                  <td colSpan={4} className="px-3 py-1.5 text-center text-[10px] text-muted-foreground italic">
                    +{overflow} more (capped at {CANDIDATE_CAP})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RagRetrievalPanel({ trace, createdAt }: { trace: RetrievalTrace; createdAt: string }) {
  const selectedIds = new Set(trace.select.selected.map((s) => s.id));

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-500/20">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
        <span className="text-sm font-medium text-amber-300">RAG Retrieval</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{formatRelative(createdAt)}</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Search query */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Search Query
          </p>
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded-md bg-muted/30 border border-border px-3 py-2 text-sm font-mono text-foreground whitespace-pre-wrap break-all">
              {trace.searchQuery}
            </div>
            <CopyButton text={trace.searchQuery} />
          </div>
        </div>

        {/* Embedder info */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Embedder
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-mono">{trace.embed.model}</Badge>
            <span className="text-[10px] text-muted-foreground">{trace.embed.provider}</span>
            <span className="text-[10px] text-muted-foreground">dims: {trace.embed.dims}</span>
          </div>
        </div>

        {/* Selected examples */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Selected Examples ({trace.select.selected.length})
            {trace.select.method && (
              <span className="ml-2 normal-case font-normal">via {trace.select.method}</span>
            )}
          </p>
          {trace.select.selected.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">None selected</p>
          ) : (
            <div className="space-y-1.5">
              {trace.select.selected.map((s) => (
                <div key={s.id} className="flex items-start gap-2 rounded-md bg-emerald-500/8 border border-emerald-500/25 px-3 py-2">
                  <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{s.title}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{s.id}</p>
                    {s.apisUsed && s.apisUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.apisUsed.map((api) => (
                          <span key={api} className="text-[9px] px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
                            {api}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Covered APIs */}
          {trace.select.coveredApis && trace.select.coveredApis.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Covered APIs:</span>
              {trace.select.coveredApis.map((api) => (
                <span key={api} className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20">
                  {api}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Candidate tables */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Candidate Lists
            <span className="ml-1 normal-case font-normal">(topK={trace.topK}; ✓ = selected)</span>
          </p>
          {trace.merged && trace.merged.length > 0 && (
            <CandidateTable label="Merged" rows={trace.merged} selectedIds={selectedIds} />
          )}
          {trace.dense && trace.dense.length > 0 && (
            <CandidateTable label="Dense" rows={trace.dense} selectedIds={selectedIds} />
          )}
          {trace.sparse && trace.sparse.length > 0 && (
            <CandidateTable label="Sparse" rows={trace.sparse} selectedIds={selectedIds} />
          )}
        </div>
      </div>
    </div>
  );
}

function LlmIoBlock({ entry }: { entry: LlmIoEntry }) {
  const [open, setOpen] = useState(false);
  const fullInputStr = entry.fullInput != null
    ? JSON.stringify(entry.fullInput, null, 2)
    : null;
  const stageLabel = STAGE_LABELS[entry.stage] ?? entry.stage;

  // RAG retrieval rows render as a dedicated panel, not standard LLM I/O blocks
  if (entry.retrievalTrace) {
    return <RagRetrievalPanel trace={entry.retrievalTrace} createdAt={entry.createdAt} />;
  }

  return (
    <div className={`rounded-lg border ${entry.error ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-background'}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className="text-sm font-medium">{stageLabel}</span>
          {entry.sceneIndex != null && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">scene {entry.sceneIndex}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">attempt {entry.attempt}</Badge>
          {entry.llmModel && (
            <Badge variant="secondary" className="text-[10px] font-mono">{entry.llmModel}</Badge>
          )}
          {entry.provider && (
            <span className="text-[10px] text-muted-foreground">{entry.provider}</span>
          )}
          {entry.tokensUsed != null && (
            <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
              {formatNumber(entry.tokensUsed, true)} tokens
            </span>
          )}
          {entry.error && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-destructive/15 text-destructive border-destructive/30 ml-auto">
              error
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
          {formatRelative(entry.createdAt)}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
          {entry.error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-mono whitespace-pre-wrap break-all">{entry.error}</p>
            </div>
          )}
          {entry.systemPrompt && <ScrollableBlock label="System prompt" content={entry.systemPrompt} />}
          {entry.userPrompt && <ScrollableBlock label="User prompt" content={entry.userPrompt} />}
          {fullInputStr && <ScrollableBlock label="Full input (JSON)" content={fullInputStr} />}
          {entry.rawOutput && <ScrollableBlock label="Raw output" content={entry.rawOutput} />}
        </div>
      )}
    </div>
  );
}

function LlmIoSection({ jobId }: { jobId: string }) {
  const {
    data: ioResponse,
    isLoading,
    isError,
  } = useAdminQuery<{ jobId: string; entries: LlmIoEntry[] }>(
    ['llm-io', { jobId }],
    `/admin/rlhf/generations/${jobId}/llm-io`
  );
  // The endpoint returns { jobId, entries: [...] } — extract the array.
  const entries: LlmIoEntry[] = Array.isArray(ioResponse?.entries) ? ioResponse.entries : [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-xs text-muted-foreground italic p-4 rounded-lg border border-border bg-muted/10">
        Could not load LLM I/O records. They may not exist yet for this job.
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        title="No LLM I/O records"
        description="I/O capture is only available for jobs processed after this feature was deployed."
        icon={Cpu}
      />
    );
  }

  // Group by stage + sceneIndex, then sort groups by defined pipeline order
  const groupMap = entries.reduce<Map<string, { stage: string; sceneIndex?: number; entries: LlmIoEntry[] }>>(
    (acc, e) => {
      const key = `${e.stage}${e.sceneIndex != null ? `-scene${e.sceneIndex}` : ''}`;
      if (!acc.has(key)) acc.set(key, { stage: e.stage, sceneIndex: e.sceneIndex, entries: [] });
      acc.get(key)!.entries.push(e);
      return acc;
    },
    new Map()
  );

  // Sort groups: first by stage pipeline order, then by sceneIndex ascending
  const sortedGroups = Array.from(groupMap.entries()).sort(([, a], [, b]) => {
    const orderDiff = stageGroupSortKey(a.stage) - stageGroupSortKey(b.stage);
    if (orderDiff !== 0) return orderDiff;
    return (a.sceneIndex ?? 0) - (b.sceneIndex ?? 0);
  });

  return (
    <div className="space-y-4">
      {sortedGroups.map(([groupKey, group]) => {
        const stageLabel = STAGE_LABELS[group.stage] ?? group.stage;
        const sceneLabel = group.sceneIndex != null ? ` › Scene ${group.sceneIndex}` : '';
        return (
          <div key={groupKey} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              {stageLabel}{sceneLabel}
            </h4>
            <div className="space-y-2">
              {group.entries.map((entry, i) => (
                <LlmIoBlock key={i} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GenerationDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const {
    data: job,
    isLoading,
    isError,
  } = useAdminQuery<JobDetailRlhf>(
    ['generation-detail', { jobId }],
    `/admin/metrics/generations/${jobId ?? ''}`
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/generation" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Skeleton className="h-6 w-56 rounded" />
        </div>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="space-y-4">
        <Link
          to="/generation"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Generation
        </Link>
        <EmptyState
          title="Job not found"
          description={`Could not load job ${jobId ?? ''}. It may have been purged.`}
          icon={Film}
        />
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalDurationMs =
    job.completedAt && job.startedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : undefined;

  const stagesMaxMs = Math.max(
    1,
    ...job.stages.map((s) => s.durationMs)
  );

  const totalTokens =
    job.tokens
      ? { input: job.tokens.input, output: job.tokens.output, total: job.tokens.input + job.tokens.output }
      : undefined;

  const failedStages = job.stages.filter((s) => s.status === 'failed');

  // ── Deep-link URLs ─────────────────────────────────────────────────────────
  const grafanaUrl = job.traceId ? grafanaTraceUrl(job.traceId) : null;
  const langfuseUrl = job.traceId ? langfuseTraceUrl(job.traceId) : null;

  return (
    <div className="space-y-6">
      {/* Back nav + header */}
      <div className="flex items-start gap-4">
        <Link
          to="/generation"
          className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Generation
        </Link>
        <PageHeader
          title={`Job ${job.jobId}`}
          description={job.prompt ? `${job.prompt.slice(0, 120)}${job.prompt.length > 120 ? '…' : ''}` : '(no prompt)'}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={job.status} />
            {/* Deep links */}
            {grafanaUrl && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                <a href={grafanaUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Grafana trace
                </a>
              </Button>
            )}
            {langfuseUrl && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                <a href={langfuseUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Langfuse
                </a>
              </Button>
            )}
          </div>
        </PageHeader>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3.5 w-3.5" />
              Total Duration
            </div>
            <p className="text-lg font-semibold tabular-nums">
              {totalDurationMs != null ? formatDuration(totalDurationMs) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {job.stages.length} stage{job.stages.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Coins className="h-3.5 w-3.5" />
              Total Tokens
            </div>
            <p className="text-lg font-semibold tabular-nums">
              {totalTokens ? formatNumber(totalTokens.total, true) : '—'}
            </p>
            {totalTokens && (
              <p className="text-[11px] text-muted-foreground">
                {formatNumber(totalTokens.input, true)} in / {formatNumber(totalTokens.output, true)} out
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Est. Cost
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatUsd(job.costUsd)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Film className="h-3.5 w-3.5" />
              Scenes
            </div>
            <p className="text-lg font-semibold tabular-nums">
              {job.sceneProgress.done}/{job.sceneProgress.total}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Started {formatRelative(job.startedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Final video player (if available) */}
      {job.finalUrl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Output Video</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <video
                src={job.finalUrl}
                controls
                className="max-h-48 rounded-md border border-border"
              />
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={job.finalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open video
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top-level failure summary (if any) */}
      {job.status === 'failed' && job.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Job Failed</p>
            <p className="text-xs font-mono text-destructive/80 mt-0.5 whitespace-pre-wrap break-all">
              {job.error}
            </p>
          </div>
        </div>
      )}

      {/* traceId ref */}
      {job.traceId && (
        <p className="text-xs text-muted-foreground">
          Trace ID:{' '}
          <code className="font-mono bg-muted px-1 rounded">{job.traceId}</code>
        </p>
      )}

      <Separator />

      {/* Stage timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            Pipeline Stages
            {failedStages.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px]">
                {failedStages.length} failed
              </Badge>
            )}
          </h2>
          {/* Service legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(SERVICE_COLORS).map(([svc, cls]) => (
              <div key={svc} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
                {svc.replace('stitcher-', '')}
              </div>
            ))}
          </div>
        </div>

        {job.stages.length === 0 ? (
          <EmptyState
            title="No stage data"
            description="This job predates per-stage tracking or the worker did not record stages."
            icon={Film}
          />
        ) : (
          <div className="space-y-2">
            {job.stages.map((stage, i) => (
              <StageRow key={i} stage={stage} maxMs={stagesMaxMs} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Rating + Curation ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            Rating &amp; Curation
            {job.debugInvoked && (
              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1
                ${job.debugResolved
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-destructive/15 text-destructive border-destructive/30'
                }`}>
                <Bug className="h-2.5 w-2.5" />
                {job.debugResolved ? 'debugged' : 'debug failed'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">User rating</span>
              <RatingStarsDetail rating={job.rating} />
              {job.ratedAt && (
                <span className="text-[10px] text-muted-foreground">{formatRelative(job.ratedAt)}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Curation decision</span>
              <CurationControlsDetail
                jobId={job.jobId || job._id}
                curationStatus={job.curationStatus ?? 'unreviewed'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── LLM I/O Viewer ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            LLM Inputs &amp; Outputs
          </h2>
          <span className="text-xs text-muted-foreground">
            Verbatim per-call I/O — present even for failed generations
          </span>
        </div>
        <LlmIoSection jobId={job.jobId || job._id} />
      </div>
    </div>
  );
}
