import {
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  Zap,
  Activity,
  Layers,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatINR, formatNumber } from '@/lib/format';
import type { OverviewMetrics, HealthResponse, LiveJobsResponse } from '@/lib/types';

import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { ServiceHealthRow } from '@/components/ServiceHealthRow';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Skeleton placeholders ───────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-1">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  );
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── Alerts banner ───────────────────────────────────────────────────────────

interface Alert {
  level: 'error' | 'warning';
  message: string;
}

function deriveAlerts(
  metrics: OverviewMetrics | undefined,
  health: HealthResponse | undefined
): Alert[] {
  const alerts: Alert[] = [];

  if (health) {
    const downServices = health.services.filter((s) => s.status === 'down');
    for (const svc of downServices) {
      alerts.push({ level: 'error', message: `Service "${svc.name}" is DOWN` });
    }
  }

  if (metrics) {
    const { generations, queue } = metrics;
    if (
      generations.last24h > 0 &&
      generations.successRate24h < 0.8
    ) {
      const pct = (generations.successRate24h * 100).toFixed(1);
      alerts.push({
        level: 'warning',
        message: `Generation success rate is ${pct}% (last 24 h) — below 80% threshold`,
      });
    }

    const totalWaiting =
      queue.generation.waiting + queue.edit.waiting;
    if (totalWaiting > 50) {
      alerts.push({
        level: 'warning',
        message: `Queue backlog: ${totalWaiting} jobs waiting across generation + edit queues`,
      });
    }
  }

  return alerts;
}

function AlertsBanner({
  alerts,
  loading,
}: {
  alerts: Alert[];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-10 w-full rounded-lg" />;

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        All systems nominal
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            alert.level === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive dark:text-red-400'
              : 'border-yellow-400/40 bg-yellow-50/60 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
          }`}
        >
          {alert.level === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          {alert.message}
        </div>
      ))}
    </div>
  );
}

// ─── Queue depth chart data ───────────────────────────────────────────────────

interface QueueBarDatum {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
}

function buildQueueChartData(metrics: OverviewMetrics): QueueBarDatum[] {
  return [
    {
      name: 'Generation',
      active: metrics.queue.generation.active,
      waiting: metrics.queue.generation.waiting,
      delayed: metrics.queue.generation.delayed,
    },
    {
      name: 'Edit',
      active: metrics.queue.edit.active,
      waiting: metrics.queue.edit.waiting,
      delayed: metrics.queue.edit.delayed,
    },
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OverviewPage() {
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useAdminQuery<OverviewMetrics>('overview-metrics', '/admin/metrics/overview');

  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
  } = useAdminQuery<HealthResponse>('admin-health', '/admin/health');

  const {
    data: liveJobs,
    isLoading: liveLoading,
  } = useAdminQuery<LiveJobsResponse>('live-jobs', '/admin/live/jobs');

  const alerts = deriveAlerts(
    metricsError ? undefined : metrics,
    healthError ? undefined : health
  );
  const alertsLoading = metricsLoading || healthLoading;

  const queueChartData = metrics ? buildQueueChartData(metrics) : [];

  // Derived KPI values
  const genSuccessDisplay = metrics
    ? `${(metrics.generations.successRate24h * 100).toFixed(1)}%`
    : '—';
  const genSuccessDelta = metrics
    ? `${formatNumber(metrics.generations.succeeded24h)} ok · ${formatNumber(metrics.generations.failed24h)} failed`
    : undefined;
  const genSuccessPositive =
    metrics ? metrics.generations.successRate24h >= 0.8 : undefined;

  const activeJobsCount =
    liveJobs?.count ??
    (metrics
      ? metrics.queue.generation.active + metrics.queue.edit.active
      : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="High-level health snapshot — KPIs, queue depth, service status, and alerts."
      />

      {/* ── Alerts banner ── */}
      <AlertsBanner alerts={alerts} loading={alertsLoading} />

      {/* ── KPI row ── */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {metricsLoading ? (
            Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : metricsError || !metrics ? (
            <div className="col-span-full text-sm text-muted-foreground">
              Failed to load overview metrics.
            </div>
          ) : (
            <>
              <KpiCard
                label="New users (24 h)"
                value={formatNumber(metrics.users.new24h)}
                delta={`7 d: ${formatNumber(metrics.users.new7d)} · 30 d: ${formatNumber(metrics.users.new30d)}`}
                icon={Users}
              />
              <KpiCard
                label="Active today"
                value={formatNumber(metrics.users.activeToday)}
                delta={`Active this week: ${formatNumber(metrics.users.activeWeek)}`}
                icon={Activity}
              />
              <KpiCard
                label="Revenue today"
                value={formatINR(metrics.revenue.today)}
                delta={`MTD: ${formatINR(metrics.revenue.mtd)}`}
                deltaPositive={metrics.revenue.today > 0}
                icon={TrendingUp}
              />
              <KpiCard
                label="Gen success (24 h)"
                value={genSuccessDisplay}
                delta={genSuccessDelta}
                deltaPositive={genSuccessPositive}
                icon={Zap}
              />
              <KpiCard
                label="Active jobs now"
                value={activeJobsCount !== undefined ? formatNumber(activeJobsCount) : '—'}
                delta={
                  liveLoading
                    ? 'Loading…'
                    : liveJobs
                      ? `${liveJobs.count} live snapshot`
                      : undefined
                }
                icon={Layers}
              />
              <KpiCard
                label="New feedback"
                value={formatNumber(metrics.feedback.new)}
                delta={`Total: ${formatNumber(metrics.feedback.total)}`}
                icon={MessageSquare}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Charts row ── */}
      <section aria-label="Queue depth and jobs">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Queue depth bar chart */}
          <ChartCard
            title="Queue depth"
            description="Active · Waiting · Delayed per queue"
            className="lg:col-span-2"
          >
            {metricsLoading ? (
              <SectionSkeleton rows={3} />
            ) : metricsError || !metrics ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Queue data unavailable.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={queueChartData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    cursor={{ fill: 'hsl(var(--muted))' }}
                  />
                  <Bar dataKey="active" name="Active" fill="hsl(var(--chart-1, 220 70% 50%))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="waiting" name="Waiting" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delayed" name="Delayed" fill="hsl(var(--chart-3, 30 80% 55%))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Jobs in last 24 h mini-stat card */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jobs last 24 h
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metricsLoading ? (
                <SectionSkeleton rows={3} />
              ) : metricsError || !metrics ? (
                <p className="text-sm text-muted-foreground">Unavailable</p>
              ) : (
                <>
                  <div>
                    <p className="text-3xl font-bold">
                      {formatNumber(metrics.generations.last24h)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total submitted</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                      <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                        {formatNumber(metrics.generations.succeeded24h)}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Succeeded</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                      <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                        {formatNumber(metrics.generations.failed24h)}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Failed</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-medium">
                      {(metrics.generations.successRate24h * 100).toFixed(1)}% success rate
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {metrics.generations.active} active right now
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Service health ── */}
      <section aria-label="Service health">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Service Health</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {healthLoading ? (
              <SectionSkeleton rows={5} />
            ) : healthError || !health ? (
              <p className="text-sm text-muted-foreground py-4">
                Health data unavailable — check server connectivity.
              </p>
            ) : health.services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No services registered.</p>
            ) : (
              <div>
                {health.services.map((svc) => (
                  <ServiceHealthRow key={svc.name} service={svc} />
                ))}
                <p className="mt-3 text-xs text-muted-foreground">
                  Snapshot generated {new Date(health.generatedAt).toLocaleTimeString()} · refreshes every 30 s
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
