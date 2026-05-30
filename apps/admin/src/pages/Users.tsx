import { useState, useCallback, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  TrendingUp,
  Search,
  MoreHorizontal,
  Ban,
  Coins,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import { useAdminQuery } from '@/lib/useAdminQuery';
import api from '@/lib/api';
import { formatNumber, formatRelative } from '@/lib/format';
import type { UsersMetrics, UsersListResponse, UserRow, UserPlan, UserRole } from '@/lib/types';
import type { DateRange } from '@/lib/types';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DataTable } from '@/components/DataTable';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<UserPlan, string> = {
  free: '#94a3b8',
  basic: '#60a5fa',
  plus: '#a78bfa',
  max: '#f59e0b',
};

const PLAN_OPTIONS: { label: string; value: UserPlan | 'all' }[] = [
  { label: 'All plans', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Basic', value: 'basic' },
  { label: 'Plus', value: 'plus' },
  { label: 'Max', value: 'max' },
];

const PAGE_LIMIT = 20;

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: UserPlan }) {
  const colorMap: Record<UserPlan, string> = {
    free: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    plus: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    max: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return (
    <Badge variant="secondary" className={`capitalize ${colorMap[plan]}`}>
      {plan}
    </Badge>
  );
}

// ─── Grant Credits Dialog ─────────────────────────────────────────────────────

interface GrantCreditsDialogProps {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function GrantCreditsDialog({ user, open, onOpenChange, onSuccess }: GrantCreditsDialogProps) {
  const [generation, setGeneration] = useState('');
  const [editing, setEditing] = useState('');
  const [mode, setMode] = useState<'add' | 'set'>('add');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/actions/users/${user._id}/credits`, {
        generation: Number(generation) || 0,
        editing: Number(editing) || 0,
        mode,
      }),
    onSuccess: () => {
      toast.success(`Credits updated for ${user.username}`);
      onOpenChange(false);
      setGeneration('');
      setEditing('');
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to update credits');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Credits — {user.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              variant={mode === 'add' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('add')}
            >
              Add
            </Button>
            <Button
              variant={mode === 'set' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('set')}
            >
              Set
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Generation credits</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={generation}
                onChange={(e) => setGeneration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Editing credits</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Current: {user.credits.generation} gen / {user.credits.editing} edit
          </p>
        </div>
        <DialogFooter showCloseButton>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!generation && !editing)}
          >
            {mutation.isPending ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

interface RowActionsProps {
  user: UserRow;
  onRefresh: () => void;
}

function RowActions({ user, onRefresh }: RowActionsProps) {
  const [creditsOpen, setCreditsOpen] = useState(false);

  const banMutation = useMutation({
    mutationFn: (banned: boolean) =>
      api.post(`/admin/actions/users/${user._id}/ban`, { banned }),
    onSuccess: (_, banned) => {
      toast.success(`${user.username} ${banned ? 'banned' : 'unbanned'}`);
      onRefresh();
    },
    onError: () => toast.error('Action failed'),
  });

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) =>
      api.post(`/admin/actions/users/${user._id}/role`, { role }),
    onSuccess: (_, role) => {
      toast.success(`${user.username} role set to ${role}`);
      onRefresh();
    },
    onError: () => toast.error('Failed to set role'),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.isActive ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => banMutation.mutate(true)}
              disabled={banMutation.isPending}
            >
              <Ban className="h-4 w-4 mr-2" />
              Ban user
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => banMutation.mutate(false)}
              disabled={banMutation.isPending}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Unban user
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setCreditsOpen(true)}>
            <Coins className="h-4 w-4 mr-2" />
            Grant credits
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.role === 'user' ? (
            <DropdownMenuItem
              onClick={() => roleMutation.mutate('admin')}
              disabled={roleMutation.isPending}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Make admin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => roleMutation.mutate('user')}
              disabled={roleMutation.isPending}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              Demote to user
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <GrantCreditsDialog
        user={user}
        open={creditsOpen}
        onOpenChange={setCreditsOpen}
        onSuccess={onRefresh}
      />
    </>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

function buildColumns(onRefresh: () => void): ColumnDef<UserRow, unknown>[] {
  return [
    {
      accessorKey: 'username',
      header: 'User',
      cell: ({ row }) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-sm leading-tight">{row.original.username}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
            {row.original.email}
          </p>
          {row.original.isTestAccount && (
            <span className="text-[10px] text-muted-foreground">[test]</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ getValue }) => <PlanBadge plan={getValue() as UserPlan} />,
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue() as UserRole;
        return (
          <Badge
            variant="outline"
            className={
              role === 'admin'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : ''
            }
          >
            {role}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() ? 'active' : 'banned'} />
      ),
    },
    {
      accessorKey: 'credits',
      header: 'Credits',
      cell: ({ row }) => (
        <div className="text-xs tabular-nums space-y-0.5">
          <div>Gen: {formatNumber(row.original.credits.generation)}</div>
          <div className="text-muted-foreground">
            Edit: {formatNumber(row.original.credits.editing)}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Joined',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelative(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'lastActive',
      header: 'Last active',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelative(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <RowActions user={row.original} onRefresh={onRefresh} />,
    },
  ];
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-48 w-full rounded-xl" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();

  // Date range state (default 30d)
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));

  // Table state
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<UserPlan | 'all'>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  }, []);

  const handlePlanChange = (value: string) => {
    setPlanFilter(value as UserPlan | 'all');
    setPage(0);
  };

  // Metrics query
  const metricsParams: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useAdminQuery<UsersMetrics>(
    ['admin/metrics/users', metricsParams],
    '/admin/metrics/users',
    metricsParams
  );

  // List query
  const listParams: Record<string, unknown> = {
    page: page + 1,
    limit: PAGE_LIMIT,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(planFilter !== 'all' ? { plan: planFilter } : {}),
  };

  const listQueryKey = ['admin/metrics/users/list', listParams];

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useAdminQuery<UsersListResponse>(listQueryKey, '/admin/metrics/users/list', listParams);

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin/metrics/users/list'] });
  }, [queryClient]);

  // Derived values
  const pageCount = listData ? Math.max(1, Math.ceil(listData.total / PAGE_LIMIT)) : 1;

  const columns = buildColumns(invalidateList);

  // Auth split bar data
  const authSplitData = metrics
    ? [
        { name: 'OAuth', value: metrics.authSplit.oauth },
        { name: 'Password', value: metrics.authSplit.password },
      ]
    : [];

  // Plan donut data
  const planDonutData = metrics
    ? metrics.byPlan.map((p) => ({ name: p.plan, value: p.count }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Users"
        description="Signups, plan distribution, auth split, and user management."
      >
        <DateRangePicker
          value={dateRange}
          onChange={(range) => {
            setDateRange(range);
          }}
          defaultPreset="30d"
        />
      </PageHeader>

      {/* KPI row */}
      {metricsLoading ? (
        <KpiSkeleton />
      ) : metricsError || !metrics ? (
        <EmptyState
          title="Failed to load metrics"
          description="Could not reach /admin/metrics/users"
          icon={Users}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total users"
            value={formatNumber(metrics.totals.total, true)}
            icon={Users}
            description="All registered accounts"
          />
          <KpiCard
            label="Active 7d"
            value={formatNumber(metrics.totals.active7d, true)}
            icon={UserCheck}
            description="Unique active last 7 days"
          />
          <KpiCard
            label="Active 30d"
            value={formatNumber(metrics.totals.active30d, true)}
            icon={TrendingUp}
            description="Unique active last 30 days"
          />
          <KpiCard
            label="Credits expiring soon"
            value={formatNumber(metrics.credits.expiringSoon, true)}
            icon={CreditCard}
            description="Generation credits expiring soon"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Signups area chart */}
        <div className="lg:col-span-2">
          {metricsLoading ? (
            <ChartSkeleton />
          ) : metrics ? (
            <ChartCard title="Signups over time" description="New user registrations">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metrics.signups} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
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
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                    formatter={(value) => [Number(value), 'signups']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#signupGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}
        </div>

        {/* Plan distribution pie */}
        <div className="space-y-4">
          {metricsLoading ? (
            <ChartSkeleton />
          ) : metrics ? (
            <ChartCard title="Plan distribution">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie
                    data={planDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                  >
                    {planDonutData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PLAN_COLORS[entry.name as UserPlan] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatNumber(Number(value)), 'users']} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}

          {/* Auth split mini bar */}
          {metricsLoading ? (
            <ChartSkeleton />
          ) : metrics ? (
            <ChartCard title="Auth method">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={authSplitData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(value) => [formatNumber(Number(value)), 'users']} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}
        </div>
      </div>

      {/* Top users */}
      {metrics && metrics.topUsers.length > 0 && (
        <ChartCard title="Top users by generations">
          <div className="divide-y">
            {metrics.topUsers.map((u, idx) => (
              <div key={u._id} className="flex items-center gap-3 py-2">
                <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <PlanBadge plan={u.plan} />
                <span className="text-sm tabular-nums font-semibold">
                  {formatNumber(u.generations, true)}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Users table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search username or email…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={planFilter} onValueChange={handlePlanChange}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {listData && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatNumber(listData.total)} users
            </span>
          )}
        </div>

        {listLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : listError || !listData ? (
          <EmptyState
            title="Failed to load users"
            description="Could not reach /admin/metrics/users/list"
            icon={UserX}
          />
        ) : listData.users.length === 0 ? (
          <EmptyState
            title="No users found"
            description={
              debouncedSearch || planFilter !== 'all'
                ? 'Try adjusting the search or plan filter.'
                : 'No users have signed up yet.'
            }
            icon={Users}
          />
        ) : (
          <DataTable
            columns={columns}
            data={listData.users}
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
