import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  CalendarDays,
  CalendarRange,
  Clock,
  Timer,
  Activity,
  UserPlus,
  Repeat,
  Eye,
  Gauge,
} from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatNumber, formatRelative } from '@/lib/format';
import type {
  AnalyticsOverview,
  AnalyticsPagesResponse,
  AnalyticsRetention,
  AnalyticsUsersResponse,
  AnalyticsUserRow,
  DateRange,
} from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(value: number | undefined, digits = 1): string {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

/** Round minutes to a friendly "X min" / "X h Y min" string. */
function formatMinutes(min: number | undefined): string {
  const m = Math.round(min ?? 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  plus: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  max: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

// ── skeleton ─────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

// ── DAU trend ────────────────────────────────────────────────────────────────

function DauTrend({ data }: { data: AnalyticsOverview['dauSeries'] }) {
  if (!data || data.length === 0) {
    return <EmptyState title="No activity yet" description="Daily active users will appear here once tracking data accumulates." />;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
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
          formatter={(value) => [formatNumber(Number(value)), 'Active users']}
          labelFormatter={(label) => `Date: ${String(label)}`}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#dauGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Retention distribution bar ──────────────────────────────────────────────

function ActiveDaysBars({ dist }: { dist: AnalyticsRetention['activeDaysDistribution'] }) {
  const buckets: { label: string; value: number }[] = [
    { label: '1 day', value: dist?.['1'] ?? 0 },
    { label: '2 days', value: dist?.['2'] ?? 0 },
    { label: '3–5 days', value: dist?.['3-5'] ?? 0 },
    { label: '6+ days', value: dist?.['6+'] ?? 0 },
  ];
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const total = buckets.reduce((s, b) => s + b.value, 0);

  if (total === 0) {
    return <EmptyState title="No activity yet" description="Active-days distribution will appear once users return." />;
  }

  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{b.label}</span>
            <span className="font-medium tabular-nums">{formatNumber(b.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60 transition-all"
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── User identity cell ───────────────────────────────────────────────────────

function UserIdentity({ row }: { row: AnalyticsUserRow }) {
  if (!row.userId) {
    return (
      <div className="min-w-[140px]">
        <p className="text-sm font-medium leading-tight italic text-muted-foreground">anonymous</p>
        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.identity}>
          {row.identity}
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-[140px]">
      <p className="text-sm font-medium leading-tight">{row.username ?? row.identity}</p>
      {row.email && (
        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.email}>
          {row.email}
        </p>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));

  const params: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
  } = useAdminQuery<AnalyticsOverview>(
    ['analytics-overview', params],
    '/admin/metrics/analytics/overview',
    params
  );

  const { data: pagesData, isLoading: pagesLoading } = useAdminQuery<AnalyticsPagesResponse>(
    ['analytics-pages', params],
    '/admin/metrics/analytics/pages',
    params
  );

  const { data: retention, isLoading: retentionLoading } = useAdminQuery<AnalyticsRetention>(
    ['analytics-retention', params],
    '/admin/metrics/analytics/retention',
    params
  );

  const usersParams: Record<string, unknown> = { ...params, limit: 100 };
  const { data: usersData, isLoading: usersLoading } = useAdminQuery<AnalyticsUsersResponse>(
    ['analytics-users', usersParams],
    '/admin/metrics/analytics/users',
    usersParams
  );

  const pages = [...(pagesData?.pages ?? [])].sort((a, b) => b.views - a.views);
  const sections = [...(pagesData?.sections ?? [])].sort((a, b) => b.totalMinutes - a.totalMinutes);
  const users = usersData?.users ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Behaviour Analytics"
        description="Active users, sessions, retention, page engagement, and per-user time spent."
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} defaultPreset="30d" />
      </PageHeader>

      {overviewLoading && <AnalyticsSkeleton />}

      {!overviewLoading && (overviewError || !overview) && (
        <EmptyState
          title="Failed to load analytics"
          description="Could not reach /admin/metrics/analytics/overview. Check backend connectivity."
          icon={Activity}
        />
      )}

      {!overviewLoading && !overviewError && overview && (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard
              label="DAU"
              value={formatNumber(overview.activeUsers?.dau ?? 0, true)}
              icon={CalendarDays}
              description="Active today"
            />
            <KpiCard
              label="WAU"
              value={formatNumber(overview.activeUsers?.wau ?? 0, true)}
              icon={CalendarRange}
              description="Active this week"
            />
            <KpiCard
              label="MAU"
              value={formatNumber(overview.activeUsers?.mau ?? 0, true)}
              icon={Users}
              description="Active this month"
            />
            <KpiCard
              label="Sessions"
              value={formatNumber(overview.sessions ?? 0, true)}
              icon={Activity}
            />
            <KpiCard
              label="Avg session"
              value={formatMinutes(overview.avgSessionMin)}
              icon={Clock}
            />
            <KpiCard
              label="Total active hours"
              value={formatNumber(Math.round(overview.totalActiveHours ?? 0), true)}
              icon={Timer}
            />
            <KpiCard
              label="Avg min / user"
              value={formatMinutes(overview.avgMinutesPerUser)}
              icon={Timer}
            />
            <KpiCard
              label="Stickiness"
              value={pct(overview.stickiness)}
              icon={Gauge}
              description="DAU / MAU"
            />
          </div>

          {/* ── DAU trend ── */}
          <ChartCard title="Daily active users" description="Unique active users per day">
            <DauTrend data={overview.dauSeries ?? []} />
          </ChartCard>

          {/* ── New vs Returning + Retention ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="New vs Returning" description="New and returning users in this range">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <UserPlus className="h-4 w-4" />
                    <span className="text-xs font-medium">New users</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                    {formatNumber(overview.newUsers ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Repeat className="h-4 w-4" />
                    <span className="text-xs font-medium">Returning</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                    {formatNumber(overview.returningUsers ?? 0)}
                  </p>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Retention" description="Recurrent and returning users + active-days spread">
              {retentionLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-md" />
                  ))}
                </div>
              ) : retention ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-semibold tabular-nums">
                        {formatNumber(retention.recurrentUsers ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Recurrent · {pct(retention.recurrentRate)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-semibold tabular-nums">
                        {formatNumber(retention.returningUsers ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Returning · {pct(retention.returningRate)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Active days per user
                    </p>
                    <ActiveDaysBars dist={retention.activeDaysDistribution} />
                  </div>
                </div>
              ) : (
                <EmptyState title="No activity yet" description="Retention data will appear as users return." />
              )}
            </ChartCard>
          </div>

          {/* ── Top pages + Top sections ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Top pages" description="Most-viewed pages by total views">
              {pagesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-md" />
                  ))}
                </div>
              ) : pages.length === 0 ? (
                <EmptyState title="No activity yet" description="Page-view data will appear once tracking accumulates." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Avg time</TableHead>
                      <TableHead className="text-right">Total min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((p) => (
                      <TableRow key={p.page}>
                        <TableCell className="font-medium max-w-[180px] truncate" title={p.page}>
                          {p.page}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.views ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.uniqueUsers ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {Math.round(p.avgSecOnPage ?? 0)}s
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(Math.round(p.totalMinutes ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ChartCard>

            <ChartCard title="Top sections" description="Engagement by app section">
              {pagesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-md" />
                  ))}
                </div>
              ) : sections.length === 0 ? (
                <EmptyState title="No activity yet" description="Section engagement will appear once tracking accumulates." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Total min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((s) => (
                      <TableRow key={s.section}>
                        <TableCell className="font-medium max-w-[200px] truncate" title={s.section}>
                          {s.section}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(s.uniqueUsers ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(Math.round(s.totalMinutes ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ChartCard>
          </div>

          {/* ── Per-user engagement ── */}
          <ChartCard
            title="Time spent by user"
            description="Per-user engagement — sessions, active days, page views, and total time"
            action={
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {users.length} shown
              </span>
            }
          >
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Per-user engagement will appear once visitors start using the app."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Days active</TableHead>
                    <TableHead className="text-right">Page views</TableHead>
                    <TableHead className="text-right">Total time</TableHead>
                    <TableHead className="text-right">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.identity}>
                      <TableCell>
                        <UserIdentity row={u} />
                      </TableCell>
                      <TableCell>
                        {u.plan ? (
                          <Badge
                            variant="secondary"
                            className={`capitalize ${PLAN_BADGE[u.plan] ?? ''}`}
                          >
                            {u.plan}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(u.sessions ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(u.daysActive ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(u.pageViews ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMinutes(u.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelative(u.lastSeen)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
