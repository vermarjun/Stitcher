import { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  LayoutTemplate,
  LifeBuoy,
  Bug,
  Coins,
  Gauge,
  AlertTriangle,
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
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatNumber, formatDuration } from '@/lib/format';
import type { PipelineMetrics, DateRange } from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Render a 0..1 fraction as a percentage string, NaN-safe. */
function pct(value: number | undefined, digits = 1): string {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

/** Format an estimated USD cost. */
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function PipelineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));

  const params: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const { data, isLoading, isError } = useAdminQuery<PipelineMetrics>(
    ['pipeline', params],
    '/admin/metrics/pipeline',
    params
  );

  const stages = data?.stages ?? [];
  // Slowest stage by p95 — used to highlight the table row.
  const slowestStage = stages.length
    ? stages.reduce((slow, s) => (s.p95Ms > slow.p95Ms ? s : slow), stages[0]).stage
    : null;

  const failureCategories = data?.failureCategories ?? [];
  const maxFailure = Math.max(...failureCategories.map((f) => f.count), 1);
  const byModel = data?.byModel ?? [];
  const byProvider = data?.byProvider ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Health"
        description="Per-stage latency, fallback resilience, failure categories, and token/cost attribution across the generation pipeline."
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} defaultPreset="30d" />
      </PageHeader>

      {isLoading && <PipelineSkeleton />}

      {!isLoading && (isError || !data) && (
        <EmptyState
          title="Failed to load pipeline metrics"
          description="Could not reach /admin/metrics/pipeline. Check backend connectivity."
          icon={Gauge}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Success rate"
              value={pct(data.rates.success)}
              icon={CheckCircle2}
              deltaPositive={(data.rates.success ?? 0) >= 0.9}
              delta={`${formatNumber(data.totals.complete ?? 0)} ok · ${formatNumber(
                data.totals.failed ?? 0
              )} failed`}
            />
            <KpiCard
              label="Real-animation rate"
              value={pct(data.rates.real)}
              icon={Sparkles}
              deltaPositive={(data.rates.real ?? 0) >= 0.8}
              delta={`${formatNumber(data.totals.real ?? 0)} real animations`}
            />
            <KpiCard
              label="Fallback title-card rate"
              value={pct(data.rates.fallbackScene)}
              icon={LayoutTemplate}
              description={`${formatNumber(data.totals.fallbackScene ?? 0)} static cards`}
            />
            <KpiCard
              label="Fallback-LLM saves"
              value={formatNumber(data.totals.fallbackLlm ?? 0)}
              icon={LifeBuoy}
              description={`${pct(data.rates.fallbackLlm)} of jobs rescued`}
            />
            <KpiCard
              label="Debug-resolve rate"
              value={pct(data.rates.debugResolved)}
              icon={Bug}
              deltaPositive={(data.rates.debugResolved ?? 0) >= 0.5}
              delta={`${pct(data.rates.debugInvoked)} jobs hit the debugger`}
            />
          </div>

          {/* ── Per-stage latency table ── */}
          <ChartCard
            title="Per-stage latency"
            description="Slowest p95 first — the slowest stage is highlighted"
          >
            {stages.length === 0 ? (
              <EmptyState title="No stage data" description="No pipeline stages ran in this range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">OK</TableHead>
                    <TableHead className="text-right">p50</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.map((s) => {
                    const isSlowest = s.stage === slowestStage;
                    return (
                      <TableRow
                        key={s.stage}
                        className={isSlowest ? 'bg-amber-50/60 dark:bg-amber-900/15' : ''}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {isSlowest && (
                              <Gauge className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            {s.stage}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(s.runs ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.okRate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(s.p50Ms ?? 0)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            isSlowest ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                          }`}
                        >
                          {formatDuration(s.p95Ms ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(s.avgMs ?? 0)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            (s.errors ?? 0) > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          {formatNumber(s.errors ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ChartCard>

          {/* ── Failure categories + tokens by provider ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Failure categories"
              description="What broke, grouped by category"
            >
              {failureCategories.length === 0 ? (
                <EmptyState
                  title="No failures"
                  description="No failures recorded in this range."
                  icon={AlertTriangle}
                />
              ) : (
                <div className="space-y-2">
                  {failureCategories.map((f) => (
                    <div key={f.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[70%] text-muted-foreground" title={f.category}>
                          {f.category}
                        </span>
                        <span className="font-medium tabular-nums shrink-0">
                          {formatNumber(f.count)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/70 transition-all"
                          style={{ width: `${(f.count / maxFailure) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Tokens by provider"
              description="Calls and token volume per LLM provider"
            >
              {byProvider.length === 0 ? (
                <EmptyState title="No provider data" description="No LLM calls in this range." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProvider.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell className="font-medium">{p.provider}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.calls ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.inputTokens ?? 0, true)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.outputTokens ?? 0, true)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.totalTokens ?? 0, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ChartCard>
          </div>

          {/* ── Tokens & cost by model ── */}
          <ChartCard
            title="Tokens & cost by model"
            description="Token volume and estimated USD cost attributed to each model"
          >
            {byModel.length === 0 ? (
              <EmptyState
                title="No model data"
                description="No LLM calls in this range."
                icon={Coins}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cost (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-medium">{m.model}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.calls ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.inputTokens ?? 0, true)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.outputTokens ?? 0, true)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(m.totalTokens ?? 0, true)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.unknownPrice ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                            est. n/a
                          </span>
                        ) : (
                          formatUsd(m.costUsd ?? 0)
                        )}
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
