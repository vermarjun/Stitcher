import { useState, useCallback, useRef } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Mail, CheckCircle2, XCircle, Percent, Search } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatNumber, formatRelative } from '@/lib/format';
import type { EmailMetrics, EmailListResponse, EmailLogEntry, EmailKind, EmailStatus, DateRange } from '@/lib/types';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { EmptyState } from '@/components/EmptyState';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const KIND_LABELS: Record<EmailKind, string> = {
  welcome: 'Welcome',
  verify_email: 'Verify email',
  collab_invite: 'Collab invite',
  password_reset: 'Password reset',
};

const KIND_COLORS: Record<EmailKind, string> = {
  welcome: '#6366f1',
  verify_email: '#0ea5e9',
  collab_invite: '#f59e0b',
  password_reset: '#ef4444',
};

const PAGE_LIMIT = 50;

function StatusBadge({ status }: { status: EmailStatus }) {
  if (status === 'sent') {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Sent
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function KindBadge({ kind }: { kind: EmailKind }) {
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {KIND_LABELS[kind] ?? kind}
    </Badge>
  );
}

const COLUMNS: ColumnDef<EmailLogEntry, unknown>[] = [
  {
    accessorKey: 'to',
    header: 'Recipient',
    cell: ({ getValue }) => (
      <span className="text-sm font-mono truncate max-w-[200px] block">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'kind',
    header: 'Type',
    cell: ({ getValue }) => <KindBadge kind={getValue() as EmailKind} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue() as EmailStatus} />,
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground truncate max-w-[220px] block">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'provider',
    header: 'Provider',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground capitalize">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'attemptsMade',
    header: 'Attempts',
    cell: ({ getValue }) => (
      <span className="text-xs tabular-nums">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'error',
    header: 'Error',
    cell: ({ getValue }) => {
      const v = getValue() as string | undefined;
      return v ? (
        <span className="text-xs text-red-600 truncate max-w-[180px] block" title={v}>{v}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: 'sentAt',
    header: 'Sent',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatRelative(getValue() as string)}
      </span>
    ),
  },
];

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export default function EmailPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<EmailKind | 'all'>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  }, []);

  const metricsParams = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const { data: metrics, isLoading: metricsLoading, isError: metricsError } =
    useAdminQuery<EmailMetrics>(['admin/metrics/email', metricsParams], '/admin/metrics/email', metricsParams);

  const listParams: Record<string, unknown> = {
    page: page + 1,
    limit: PAGE_LIMIT,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(kindFilter !== 'all' ? { kind: kindFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const { data: listData, isLoading: listLoading, isError: listError } =
    useAdminQuery<EmailListResponse>(
      ['admin/metrics/email/list', listParams],
      '/admin/metrics/email/list',
      listParams
    );

  const pageCount = listData ? Math.max(1, Math.ceil(listData.total / PAGE_LIMIT)) : 1;

  const byKindChartData = metrics?.byKind.map((k) => ({
    name: KIND_LABELS[k.kind] ?? k.kind,
    sent: k.sent,
    failed: k.failed,
  })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Email" description="Delivery log, failure tracking, and send volume by type.">
        <DateRangePicker
          value={dateRange}
          onChange={(r) => { setDateRange(r); setPage(0); }}
          defaultPreset="30d"
        />
      </PageHeader>

      {metricsLoading ? (
        <KpiSkeleton />
      ) : metricsError || !metrics ? (
        <EmptyState title="Failed to load metrics" description="Could not reach /admin/metrics/email" icon={Mail} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total sent"
            value={formatNumber(metrics.totals.total, true)}
            icon={Mail}
            description="Emails enqueued in range"
          />
          <KpiCard
            label="Delivered"
            value={formatNumber(metrics.totals.sent, true)}
            icon={CheckCircle2}
            description="Successfully delivered"
          />
          <KpiCard
            label="Failed"
            value={formatNumber(metrics.totals.failed, true)}
            icon={XCircle}
            description="All retries exhausted"
          />
          <KpiCard
            label="Delivery rate"
            value={`${(metrics.totals.deliveryRate * 100).toFixed(1)}%`}
            icon={Percent}
            description="Sent / total"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {metrics && metrics.series.length > 0 && (
          <ChartCard title="Send volume over time" description="Delivered vs failed per day">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metrics.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(l) => new Date(String(l)).toLocaleDateString()}
                  formatter={(v, name) => [Number(v), String(name)]}
                />
                <Area type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="none" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {metrics && byKindChartData.length > 0 && (
          <ChartCard title="By email type">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byKindChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, name) => [Number(v), String(name)]} />
                <Bar dataKey="sent" fill="#6366f1" radius={[3, 3, 0, 0]} name="Sent" />
                <Bar dataKey="failed" fill="#ef4444" radius={[3, 3, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search recipient email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as EmailStatus | 'all'); setPage(0); }}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={kindFilter} onValueChange={(v) => { setKindFilter(v as EmailKind | 'all'); setPage(0); }}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="welcome">Welcome</SelectItem>
              <SelectItem value="verify_email">Verify email</SelectItem>
              <SelectItem value="collab_invite">Collab invite</SelectItem>
              <SelectItem value="password_reset">Password reset</SelectItem>
            </SelectContent>
          </Select>

          {listData && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatNumber(listData.total)} records
            </span>
          )}
        </div>

        {listLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : listError || !listData ? (
          <EmptyState title="Failed to load logs" description="Could not reach /admin/metrics/email/list" icon={Mail} />
        ) : listData.logs.length === 0 ? (
          <EmptyState
            title="No emails found"
            description={debouncedSearch || statusFilter !== 'all' || kindFilter !== 'all'
              ? 'Try adjusting the filters.'
              : 'No emails have been sent yet.'}
            icon={Mail}
          />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={listData.logs}
            pageSize={PAGE_LIMIT}
            pageCount={pageCount}
            currentPage={page}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
