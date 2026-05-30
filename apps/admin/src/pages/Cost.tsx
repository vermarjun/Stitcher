import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Calculator,
  ExternalLink,
  Database,
  BarChart2,
} from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { EmptyState } from '@/components/EmptyState';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatNumber } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CostMetrics, DateRange } from '@/lib/types';

// ─── env ─────────────────────────────────────────────────────────────────────
const LANGFUSE_URL = import.meta.env.VITE_LANGFUSE_URL ?? 'http://localhost:3002';
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3001';

// ─── helpers ─────────────────────────────────────────────────────────────────
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatUsdShort(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

function sourceBadgeVariant(source: string): 'default' | 'secondary' | 'outline' {
  if (source === 'prometheus') return 'default';
  if (source === 'persisted') return 'secondary';
  return 'outline';
}

function sourceBadgeLabel(source: string): string {
  if (source === 'prometheus') return 'Prometheus';
  if (source === 'persisted') return 'Persisted DB';
  return 'No source';
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function CostSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function CostPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));

  const params: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const { data, isLoading, error } = useAdminQuery<CostMetrics>(
    ['cost', params],
    '/admin/metrics/cost',
    params
  );

  // ── derived flags ────────────────────────────────────────────────────────
  const isEmpty =
    !data ||
    data.source === 'none' ||
    (data.tokens?.total ?? 0) === 0;

  const source = data?.source ?? 'none';
  const tokens = data?.tokens;
  const cost = data?.cost;
  const series = data?.series ?? [];
  const byModel = tokens?.byModel ?? [];
  const byRole = tokens?.byRole ?? [];
  const costByModel = cost?.byModel ?? [];

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header — always visible */}
      <PageHeader
        title="LLM Cost & Tokens"
        description="Token usage and estimated LLM cost breakdown by model and role."
      >
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant={sourceBadgeVariant(source)}>
              {sourceBadgeLabel(source)}
            </Badge>
          )}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </PageHeader>

      {/* Loading */}
      {isLoading && <CostSkeleton />}

      {/* Error */}
      {!isLoading && error && (
        <EmptyState
          title="Failed to load cost metrics"
          description={String(error)}
          icon={BarChart2}
        />
      )}

      {/* Empty / no-source state */}
      {!isLoading && !error && isEmpty && (
        <EmptyState
          title="No token data available"
          description={
            data?.note
              ? data.note
              : 'The Agent service is not yet emitting token metrics. Instrument your LLM calls to record token counts, then metrics will appear here.'
          }
          icon={Coins}
        >
          <p className="text-xs text-muted-foreground max-w-md">
            Token data is sourced from Prometheus (live) or the persisted DB.
            Until the Agent service emits spans with token counts, this page
            will remain empty. Check Langfuse traces or Grafana dashboards to
            inspect raw LLM calls.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(LANGFUSE_URL, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              Open Langfuse
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(GRAFANA_URL, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              Open Grafana
            </Button>
          </div>
        </EmptyState>
      )}

      {/* Full data view */}
      {!isLoading && !error && !isEmpty && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Total Tokens"
              value={formatNumber(tokens?.total ?? 0, true)}
              icon={Coins}
              description="input + output"
            />
            <KpiCard
              label="Input Tokens"
              value={formatNumber(tokens?.input ?? 0, true)}
              icon={ArrowDownToLine}
            />
            <KpiCard
              label="Output Tokens"
              value={formatNumber(tokens?.output ?? 0, true)}
              icon={ArrowUpFromLine}
            />
            <KpiCard
              label="Total Cost"
              value={formatUsdShort(cost?.totalUsd ?? 0)}
              icon={DollarSign}
              description="estimated USD"
            />
            <KpiCard
              label="Avg Cost / Job"
              value={formatUsd(cost?.perJobAvgUsd ?? 0)}
              icon={Calculator}
              description="USD per generation"
            />
          </div>

          {/* Charts row 1: tokens by model + input vs output over time */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tokens by model — grouped bar */}
            <ChartCard
              title="Tokens by Model"
              description="Input and output tokens grouped by LLM model"
            >
              {byModel.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No model breakdown available.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byModel} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="model"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatNumber(v, true)}
                      className="fill-muted-foreground"
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="input" name="Input" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="output" name="Output" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Input vs Output over time — stacked area */}
            <ChartCard
              title="Token Usage Over Time"
              description="Daily input and output token volume"
            >
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No time series data available.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gradInput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradOutput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d: string) => d.slice(5)} // MM-DD
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatNumber(v, true)}
                      className="fill-muted-foreground"
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="input"
                      name="Input"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#gradInput)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="output"
                      name="Output"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#gradOutput)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Charts row 2: cost by model + tokens by role */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cost by model */}
            <ChartCard
              title="Cost by Model"
              description="Estimated USD cost attributed to each model"
            >
              {costByModel.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No cost breakdown available.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={costByModel}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      type="category"
                      dataKey="model"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      formatter={(value) => formatUsdShort(Number(value))}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Bar dataKey="usd" name="Cost (USD)" fill="hsl(var(--chart-3))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Tokens by role */}
            <ChartCard
              title="Tokens by Role"
              description="Token volume split by message role (system / user / assistant / tool)"
            >
              {byRole.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No role breakdown available.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byRole} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="role"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatNumber(v, true)}
                      className="fill-muted-foreground"
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Bar dataKey="tokens" name="Tokens" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* External links footer */}
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => window.open(LANGFUSE_URL, '_blank', 'noopener,noreferrer')}
                >
                  <Database className="h-3.5 w-3.5" />
                  Langfuse traces
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => window.open(GRAFANA_URL, '_blank', 'noopener,noreferrer')}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Grafana dashboard
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
