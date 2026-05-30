import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { ExternalLink, Activity, Clock, RotateCcw, Film, XCircle, CheckCircle2, Hash } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { PageHeader } from '@/components/PageHeader';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatDuration, formatRelative, formatNumber } from '@/lib/format';
import type {
  GenerationsMetrics,
  JobsListResponse,
  JobRow,
  JobStatus,
  JobQueue,
  DateRange,
} from '@/lib/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3001';

const ALL_STATUSES: (JobStatus | 'all')[] = [
  'all',
  'queued',
  'planning',
  'rendering',
  'concatenating',
  'uploading',
  'complete',
  'failed',
  'cancelled',
];

const STATUS_COLORS: Record<string, string> = {
  complete: '#22c55e',
  failed: '#ef4444',
  cancelled: '#a1a1aa',
  queued: '#94a3b8',
  planning: '#3b82f6',
  rendering: '#eab308',
  concatenating: '#f97316',
  uploading: '#a855f7',
};

const QUEUE_COLORS = { generation: '#6366f1', edit: '#0ea5e9' };

const PAGE_SIZE = 20;

// ── Skeleton helpers ───────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Stacked area chart: complete / failed / cancelled over time */
function SeriesChart({ data }: { data: GenerationsMetrics['series'] }) {
  if (!data.length) return <EmptyState title="No series data" description="No generations in this date range." />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {(['complete', 'failed', 'cancelled'] as const).map((key) => (
            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STATUS_COLORS[key]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={STATUS_COLORS[key]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
          className="fill-muted-foreground"
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="fill-muted-foreground" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          labelFormatter={(label) => `Date: ${String(label)}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {(['complete', 'failed', 'cancelled'] as const).map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stackId="1"
            stroke={STATUS_COLORS[key]}
            fill={`url(#grad-${key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Status breakdown donut */
function StatusDonut({ data }: { data: GenerationsMetrics['statusBreakdown'] }) {
  if (!data.length) return <EmptyState title="No breakdown data" />;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="count"
            nameKey="status"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={STATUS_COLORS[entry.status] ?? `hsl(${(i * 40) % 360} 60% 55%)`}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => { const v = Number(value); return [`${v} (${((v / total) * 100).toFixed(1)}%)`, 'Jobs']; }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 text-xs">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: STATUS_COLORS[d.status] ?? '#888' }}
            />
            <span className="capitalize text-muted-foreground">{d.status}</span>
            <span className="font-medium tabular-nums ml-auto pl-3">{formatNumber(d.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Queue split: generation vs edit */
function QueueSplitChart({ data }: { data: GenerationsMetrics['queueSplit'] }) {
  const total = data.generation + data.edit;
  if (total === 0) return <EmptyState title="No queue data" />;

  const barData = [
    { name: 'generation', value: data.generation },
    { name: 'edit', value: data.edit },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Generation</span>
        <span className="font-semibold tabular-nums">
          {formatNumber(data.generation)} ({((data.generation / total) * 100).toFixed(0)}%)
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Edit</span>
        <span className="font-semibold tabular-nums">
          {formatNumber(data.edit)} ({((data.edit / total) * 100).toFixed(0)}%)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Jobs']} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {barData.map((entry, i) => (
              <Cell key={i} fill={QUEUE_COLORS[entry.name as keyof typeof QUEUE_COLORS] ?? '#888'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Failure reasons bar list */
function FailureReasonsList({ data }: { data: GenerationsMetrics['failureReasons'] }) {
  if (!data.length) return <EmptyState title="No failures" description="No failure reasons in this period." />;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate max-w-[70%] text-muted-foreground" title={item.reason}>
              {item.reason}
            </span>
            <span className="font-medium tabular-nums shrink-0">{formatNumber(item.count)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-destructive/70 transition-all"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Top prompt terms ranked bar list */
function TopPromptTerms({ data }: { data: GenerationsMetrics['topPromptTerms'] }) {
  if (!data.length) return <EmptyState title="No terms" description="Not enough prompt data." />;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.slice(0, 20).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-5 text-right text-xs text-muted-foreground shrink-0">{i + 1}</span>
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{item.term}</span>
              <span className="text-muted-foreground tabular-nums">{formatNumber(item.count)}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Recent prompts feed */
function RecentPromptsFeed({ data }: { data: GenerationsMetrics['recentPrompts'] }) {
  if (!data.length) return <EmptyState title="No recent prompts" />;

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" title={item.prompt}>
              {item.prompt}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRelative(item.createdAt)}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

// ── Jobs table columns ─────────────────────────────────────────────────────────

const jobColumns: ColumnDef<JobRow, unknown>[] = [
  {
    accessorKey: 'prompt',
    header: 'Prompt',
    cell: ({ row }) => (
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>
            <span className="block max-w-[220px] truncate text-sm cursor-default">
              {row.original.prompt}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-wrap">
            {row.original.prompt}
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    ),
  },
  {
    accessorKey: 'queue',
    header: 'Queue',
    cell: ({ row }) => (
      <span className="capitalize text-xs text-muted-foreground">{row.original.queue}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'sceneProgress',
    header: 'Scenes',
    cell: ({ row }) => {
      const { done, total } = row.original.sceneProgress;
      return (
        <span className="text-xs tabular-nums">
          {done}/{total}
        </span>
      );
    },
  },
  {
    accessorKey: 'durationMs',
    header: 'Duration',
    cell: ({ row }) =>
      row.original.durationMs != null ? (
        <span className="text-xs tabular-nums">{formatDuration(row.original.durationMs)}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{formatRelative(row.original.startedAt)}</span>
    ),
  },
  {
    id: 'trace',
    header: '',
    cell: ({ row }) => {
      const { traceId } = row.original;
      if (!traceId) return null;
      const url = `${GRAFANA_URL}/explore?left=${encodeURIComponent(
        JSON.stringify({ datasource: 'tempo', queries: [{ query: traceId }] })
      )}`;
      return (
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Trace
              </a>
            </TooltipTrigger>
            <TooltipContent>Open trace in Grafana</TooltipContent>
          </UITooltip>
        </TooltipProvider>
      );
    },
  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GenerationPage() {
  const [dateRange, setDateRange] = useState<DateRange>(presetToRange('30d'));
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<JobQueue | 'all'>('all');
  const [jobsPage, setJobsPage] = useState(0);

  // ── Metrics query ──────────────────────────────────────────────────────────
  const metricsParams: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useAdminQuery<GenerationsMetrics>(
    ['generations-metrics', metricsParams],
    '/admin/metrics/generations',
    metricsParams
  );

  // ── Jobs list query ────────────────────────────────────────────────────────
  const listParams: Record<string, unknown> = {
    page: jobsPage + 1,
    limit: PAGE_SIZE,
  };
  if (statusFilter !== 'all') listParams.status = statusFilter;
  if (queueFilter !== 'all') listParams.queue = queueFilter;

  const {
    data: jobsData,
    isLoading: jobsLoading,
  } = useAdminQuery<JobsListResponse>(
    ['generations-list', listParams],
    '/admin/metrics/generations/list',
    listParams
  );

  // Reset to page 0 when filters change
  const handleStatusChange = (val: string) => {
    setStatusFilter(val as JobStatus | 'all');
    setJobsPage(0);
  };
  const handleQueueChange = (val: string) => {
    setQueueFilter(val as JobQueue | 'all');
    setJobsPage(0);
  };

  const jobsPageCount = jobsData ? Math.ceil(jobsData.total / PAGE_SIZE) : 0;

  // ── KPI values ─────────────────────────────────────────────────────────────
  const kpis = metrics
    ? [
        {
          label: 'Success Rate',
          value: `${(metrics.successRate * 100).toFixed(1)}%`,
          icon: CheckCircle2,
          deltaPositive: metrics.successRate >= 0.9,
          delta: metrics.successRate >= 0.9 ? 'Healthy' : 'Below target',
        },
        {
          label: 'Failure Rate',
          value: `${(metrics.failureRate * 100).toFixed(1)}%`,
          icon: XCircle,
          deltaPositive: metrics.failureRate < 0.1,
          delta: metrics.failureRate >= 0.2 ? 'High — investigate' : undefined,
        },
        {
          label: 'p50 Duration',
          value: formatDuration(metrics.duration.p50Ms),
          icon: Clock,
          description: 'Median job duration',
        },
        {
          label: 'p95 Duration',
          value: formatDuration(metrics.duration.p95Ms),
          icon: Activity,
          description: '95th-percentile duration',
        },
        {
          label: 'Retry Rate',
          value: `${(metrics.retryRate * 100).toFixed(1)}%`,
          icon: RotateCcw,
          deltaPositive: metrics.retryRate < 0.1,
        },
        {
          label: 'Avg Scenes',
          value: metrics.avgScenes.toFixed(1),
          icon: Film,
          description: 'Scenes per job',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Generation"
        description="Job status breakdown, duration percentiles, failure reasons, and jobs table."
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} defaultPreset="30d" />
      </PageHeader>

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      {metricsLoading ? (
        <KpiSkeleton />
      ) : metricsError || !metrics ? (
        <EmptyState
          title="Failed to load metrics"
          description="Could not reach /admin/metrics/generations. Check backend connectivity."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              delta={kpi.delta}
              deltaPositive={kpi.deltaPositive}
              description={'description' in kpi ? kpi.description : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Charts row 1: series + status donut ────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Jobs Over Time"
          description="Complete / Failed / Cancelled per day"
        >
          {metricsLoading ? (
            <ChartSkeleton />
          ) : metrics?.series ? (
            <SeriesChart data={metrics.series} />
          ) : (
            <EmptyState title="No data" />
          )}
        </ChartCard>

        <ChartCard title="Status Breakdown" description="Distribution of all job statuses">
          {metricsLoading ? (
            <ChartSkeleton height={200} />
          ) : metrics?.statusBreakdown ? (
            <StatusDonut data={metrics.statusBreakdown} />
          ) : (
            <EmptyState title="No data" />
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2: queue split + failure reasons + top terms ────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Queue Split" description="Generation vs Edit jobs">
          {metricsLoading ? (
            <ChartSkeleton height={140} />
          ) : metrics?.queueSplit ? (
            <QueueSplitChart data={metrics.queueSplit} />
          ) : (
            <EmptyState title="No data" />
          )}
        </ChartCard>

        <ChartCard title="Why Jobs Fail" description="Top failure reasons">
          {metricsLoading ? (
            <ChartSkeleton height={200} />
          ) : metrics?.failureReasons ? (
            <FailureReasonsList data={metrics.failureReasons} />
          ) : (
            <EmptyState title="No data" />
          )}
        </ChartCard>

        <ChartCard title="Top Prompt Terms" description="Most common words in prompts">
          {metricsLoading ? (
            <ChartSkeleton height={200} />
          ) : metrics?.topPromptTerms ? (
            <TopPromptTerms data={metrics.topPromptTerms} />
          ) : (
            <EmptyState title="No data" />
          )}
        </ChartCard>
      </div>

      {/* ── Recent prompts feed ─────────────────────────────────────────────── */}
      <ChartCard
        title="Recent Prompts"
        description="Latest generation requests"
        action={
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {metrics?.recentPrompts?.length ?? 0} shown
          </span>
        }
      >
        {metricsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : metrics?.recentPrompts ? (
          <RecentPromptsFeed data={metrics.recentPrompts} />
        ) : (
          <EmptyState title="No recent prompts" />
        )}
      </ChartCard>

      {/* ── Jobs table ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Jobs</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter tabs (condensed on small screens via select) */}
            <div className="hidden xl:block">
              <Tabs value={statusFilter} onValueChange={handleStatusChange}>
                <TabsList>
                  {ALL_STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s} className="capitalize text-xs px-2.5 py-1">
                      {s}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="xl:hidden">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Queue filter */}
            <Select value={queueFilter} onValueChange={handleQueueChange}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="Queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All queues</SelectItem>
                <SelectItem value="generation">Generation</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset filters */}
            {(statusFilter !== 'all' || queueFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setQueueFilter('all');
                  setJobsPage(0);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {jobsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : !jobsData || jobsData.jobs.length === 0 ? (
          <EmptyState
            title="No jobs found"
            description="Try adjusting the status or queue filter."
          />
        ) : (
          <DataTable<JobRow>
            columns={jobColumns}
            data={jobsData.jobs}
            pageSize={PAGE_SIZE}
            pageCount={jobsPageCount}
            currentPage={jobsPage}
            onPageChange={setJobsPage}
          />
        )}

        {jobsData && (
          <p className="text-xs text-muted-foreground text-right">
            {formatNumber(jobsData.total)} total jobs
          </p>
        )}
      </div>
    </div>
  );
}
