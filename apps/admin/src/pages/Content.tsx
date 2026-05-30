import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  FolderOpen,
  Film,
  HardDrive,
  FileText,
  Eye,
  Share2,
  Heart,
  MessageCircle,
  Users,
  LayoutTemplate,
  Star,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { DateRangePicker, presetToRange } from '@/components/DateRangePicker';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { formatBytes, formatNumber } from '@/lib/format';
import api from '@/lib/api';
import type { ContentMetrics, TopPost, DateRange } from '@/lib/types';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Palette for pie/donut charts ────────────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'];

// ─── Loading skeleton grid ───────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`h-64 rounded-xl ${className ?? ''}`} />;
}

// ─── Confirm-delete dialog ────────────────────────────────────────────────────
interface DeleteDialogProps {
  post: TopPost | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function DeleteDialog({ post, onClose, onConfirm, isPending }: DeleteDialogProps) {
  return (
    <Dialog open={post !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Remove Post
          </DialogTitle>
          <DialogDescription>
            This will permanently remove{' '}
            <span className="font-medium text-foreground">"{post?.title}"</span> by{' '}
            <span className="font-medium text-foreground">{post?.author}</span>. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Removing…' : 'Remove Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Top Posts table ──────────────────────────────────────────────────────────
interface TopPostsTableProps {
  posts: TopPost[];
  onFeature: (post: TopPost, featured: boolean) => void;
  onDelete: (post: TopPost) => void;
  featurePending: string | null;
}

function TopPostsTable({ posts, onFeature, onDelete, featurePending }: TopPostsTableProps) {
  const columns: ColumnDef<TopPost, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-medium line-clamp-1 max-w-[240px]">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'author',
      header: 'Author',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.author}</span>
      ),
    },
    {
      accessorKey: 'likesCount',
      header: 'Likes',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-rose-500" />
          <span>{formatNumber(row.original.likesCount)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'views',
      header: 'Views',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-blue-500" />
          <span>{formatNumber(row.original.views)}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const post = row.original;
        const isBusy = featurePending === post._id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onFeature(post, true)}>
                <Star className="mr-2 h-4 w-4 text-amber-500" />
                Feature
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFeature(post, false)}>
                <Star className="mr-2 h-4 w-4 text-muted-foreground" />
                Unfeature
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(post)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No community posts yet"
        description="Top posts will appear here once users start sharing."
        icon={FileText}
      />
    );
  }

  return <DataTable columns={columns} data={posts} pageSize={10} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ContentPage() {
  const [dateRange, setDateRange] = useState<DateRange>(presetToRange('30d'));
  const [deleteTarget, setDeleteTarget] = useState<TopPost | null>(null);
  const [featurePending, setFeaturePending] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const params: Record<string, unknown> = {
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  };

  const CONTENT_KEY = ['content-metrics', params] as const;

  const { data, isLoading, isError } = useAdminQuery<ContentMetrics>(
    CONTENT_KEY,
    '/admin/metrics/content',
    params
  );

  // Feature / Unfeature mutation
  const featureMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      api.post(`/admin/actions/posts/${id}/feature`, { featured }),
    onMutate: ({ id }) => setFeaturePending(id),
    onSuccess: (_, { featured }) => {
      queryClient.invalidateQueries({ queryKey: CONTENT_KEY });
      toast.success(featured ? 'Post featured' : 'Post unfeatured');
    },
    onError: () => toast.error('Failed to update post'),
    onSettled: () => setFeaturePending(null),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/actions/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_KEY });
      toast.success('Post removed');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to remove post'),
  });

  const handleFeature = (post: TopPost, featured: boolean) => {
    featureMutation.mutate({ id: post._id, featured });
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget._id);
  };

  // ── Derived series data ──────────────────────────────────────────────────
  const projectsByStatus = data?.projects.byStatus ?? [];
  const createdSeries = data?.projects.createdSeries ?? [];
  const assetsByOrigin = data?.assets.byOrigin ?? [];
  const assetsByType = data?.assets.byType ?? [];
  const topPosts = data?.community.topPosts ?? [];
  const topLiked = data?.templates.topLiked ?? [];

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Content"
        description="Projects, assets, community posts, shares, templates, and collaboration metrics."
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </PageHeader>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <KpiSkeleton />
      ) : isError || !data ? (
        <EmptyState
          title="Failed to load content metrics"
          description="Check your network connection or backend logs."
          icon={AlertTriangle}
        />
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Total Projects"
            value={formatNumber(data.projects.total)}
            icon={FolderOpen}
          />
          <KpiCard
            label="Total Assets"
            value={formatNumber(data.assets.total)}
            icon={Film}
          />
          <KpiCard
            label="Storage Used"
            value={formatBytes(data.assets.storageBytes)}
            icon={HardDrive}
          />
          <KpiCard
            label="Community Posts"
            value={formatNumber(data.community.posts)}
            icon={FileText}
          />
          <KpiCard
            label="Total Views"
            value={formatNumber(data.shares.totalViews, true)}
            icon={Eye}
          />
          <KpiCard
            label="Total Shares"
            value={formatNumber(data.shares.total)}
            icon={Share2}
          />
        </div>
      )}

      {/* ── Charts Row 1: Projects ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Projects by Status — donut */}
          <ChartCard
            title="Projects by Status"
            description="Distribution across draft, in_progress, compiled, error"
          >
            {projectsByStatus.length === 0 ? (
              <EmptyState title="No project data" icon={FolderOpen} className="py-10" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={projectsByStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {projectsByStatus.map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value))}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span key={String(value)} className="capitalize text-sm text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Projects Created Over Time — area */}
          <ChartCard
            title="Projects Created Over Time"
            description="New projects per day in the selected range"
          >
            {createdSeries.length === 0 ? (
              <EmptyState title="No time-series data" icon={FolderOpen} className="py-10" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={createdSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    formatter={(value) => [formatNumber(Number(value)), 'Projects']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Charts Row 2: Assets ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Assets by Origin — donut */}
          <ChartCard
            title="Assets by Origin"
            description="template · upload · generated_video"
          >
            {assetsByOrigin.length === 0 ? (
              <EmptyState title="No asset data" icon={Film} className="py-10" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={assetsByOrigin}
                    dataKey="count"
                    nameKey="origin"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {assetsByOrigin.map((entry, index) => (
                      <Cell
                        key={entry.origin}
                        fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value))}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-sm text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Assets by Type — bar */}
          <ChartCard
            title="Assets by Type"
            description="Video vs audio asset counts"
          >
            {assetsByType.length === 0 ? (
              <EmptyState title="No asset type data" icon={Film} className="py-10" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={assetsByType}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    formatter={(value) => [formatNumber(Number(value)), 'Assets']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {assetsByType.map((entry, index) => (
                      <Cell
                        key={entry.type}
                        fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Community Section ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Community</h2>

        {/* Engagement KPIs */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : data && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <KpiCard
              label="Total Likes"
              value={formatNumber(data.community.likes)}
              icon={Heart}
            />
            <KpiCard
              label="Total Comments"
              value={formatNumber(data.community.comments)}
              icon={MessageCircle}
            />
            <KpiCard
              label="Community Views"
              value={formatNumber(data.community.views, true)}
              icon={Eye}
            />
          </div>
        )}

        {/* Top Posts Table */}
        <ChartCard
          title="Top Posts"
          description="Community posts ranked by engagement — feature or remove from here"
        >
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : (
            <TopPostsTable
              posts={topPosts}
              onFeature={handleFeature}
              onDelete={(post) => setDeleteTarget(post)}
              featurePending={featurePending}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Collab + Templates Section ──────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Collaboration stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{formatNumber(data.collab.invites)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Invites Sent</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{formatNumber(data.collab.accepted)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Accepted</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {(data.collab.acceptanceRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Accept Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                Templates
                <Badge variant="secondary" className="ml-auto">
                  {formatNumber(data.templates.total)} total
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topLiked.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  description="Top liked templates will appear here."
                  icon={LayoutTemplate}
                  className="py-6"
                />
              ) : (
                <ul className="space-y-2">
                  {topLiked.slice(0, 5).map((tpl, i) => (
                    <li
                      key={tpl._id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground w-4 shrink-0">
                          {i + 1}.
                        </span>
                        <span className="truncate font-medium">{tpl.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2 text-muted-foreground">
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        <span>{formatNumber(tpl.likes)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete confirm dialog ────────────────────────────────────────── */}
      <DeleteDialog
        post={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
