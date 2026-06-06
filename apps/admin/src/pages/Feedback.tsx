import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  Clock,
  Inbox,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { useAdminQuery } from '@/lib/useAdminQuery';
import api from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type {
  FeedbackItem,
  FeedbackListResponse,
  FeedbackUpdateResponse,
  FeedbackStatus,
  FeedbackType,
} from '@/lib/types';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: FeedbackStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'resolved', label: 'Resolved' },
];

const TYPE_OPTIONS: { value: FeedbackType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'Bug', label: 'Bug' },
  { value: 'Idea', label: 'Idea' },
  { value: 'Other', label: 'Other' },
];

const PAGE_LIMIT = 20;

// ── Detail dialog ─────────────────────────────────────────────────────────────

interface DetailDialogProps {
  item: FeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailDialog({ item, open, onOpenChange }: DetailDialogProps) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusBadge status={item.type} />
            Feedback Detail
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
            <p className="whitespace-pre-wrap break-words">{item.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
              <StatusBadge status={item.status} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Submitted by</p>
              <p className="font-medium">
                {item.user ? item.user.username : '—'}
              </p>
              {item.user && (
                <p className="text-muted-foreground text-xs">{item.user.email}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Submitted</p>
              <p>{formatRelative(item.createdAt)}</p>
            </div>
            {item.resolvedAt && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Resolved</p>
                <p>{formatRelative(item.resolvedAt)}</p>
              </div>
            )}
          </div>
          {item.adminNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Admin Note</p>
              <p className="whitespace-pre-wrap break-words bg-muted rounded-md p-3 text-xs">
                {item.adminNote}
              </p>
            </div>
          )}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// ── Admin note dialog ─────────────────────────────────────────────────────────

interface NoteDialogProps {
  item: FeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, note: string) => void;
  isSaving: boolean;
}

function NoteDialog({ item, open, onOpenChange, onSave, isSaving }: NoteDialogProps) {
  const [note, setNote] = useState(item?.adminNote ?? '');

  // Sync note when dialog opens with a new item
  const handleOpenChange = (o: boolean) => {
    if (o) setNote(item?.adminNote ?? '');
    onOpenChange(o);
  };

  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{item.message}</p>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none dark:bg-input/30"
            placeholder="Add an internal note about this feedback…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => onSave(item._id, note)}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Row actions cell ──────────────────────────────────────────────────────────

interface RowActionsProps {
  item: FeedbackItem;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onOpenNote: (item: FeedbackItem) => void;
  isUpdating: boolean;
}

function RowActions({ item, onStatusChange, onOpenNote, isUpdating }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            disabled={isUpdating}
          >
            <StatusBadge status={item.status} className="text-xs" />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(['new', 'triaged', 'resolved'] as FeedbackStatus[]).map((s) => (
            <DropdownMenuItem
              key={s}
              disabled={item.status === s}
              onClick={() => onStatusChange(item._id, s)}
            >
              <StatusBadge status={s} className="text-xs" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onOpenNote(item)}
        title="Edit admin note"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Loading skeletons ─────────────────────────────────────────────────────────

function KpiSkeletons() {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const qc = useQueryClient();

  // ── Filter state
  const [statusTab, setStatusTab] = useState<FeedbackStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [page, setPage] = useState(0); // 0-indexed internally, 1-indexed for API

  // Reset to page 0 when filters change
  const handleStatusChange = (v: FeedbackStatus | 'all') => {
    setStatusTab(v);
    setPage(0);
  };
  const handleTypeChange = (v: FeedbackType | 'all') => {
    setTypeFilter(v);
    setPage(0);
  };

  // ── Query params
  const params: Record<string, unknown> = {
    page: page + 1,
    limit: PAGE_LIMIT,
  };
  if (statusTab !== 'all') params.status = statusTab;
  if (typeFilter !== 'all') params.type = typeFilter;

  const queryKey = ['feedback', params] as const;
  const { data, isLoading, isError } = useAdminQuery<FeedbackListResponse>(
    queryKey,
    '/admin/feedback',
    params
  );

  // ── Mutations
  const updateMutation = useMutation<
    FeedbackUpdateResponse,
    Error,
    { id: string; payload: Partial<{ status: FeedbackStatus; adminNote: string }> }
  >({
    mutationFn: ({ id, payload }) =>
      api.patch<FeedbackUpdateResponse>(`/admin/feedback/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback updated');
    },
    onError: () => {
      toast.error('Failed to update feedback');
    },
  });

  const handleStatusChange2 = (id: string, status: FeedbackStatus) => {
    updateMutation.mutate({ id, payload: { status } });
  };

  const handleNoteSave = (id: string, adminNote: string) => {
    updateMutation.mutate(
      { id, payload: { adminNote } },
      { onSuccess: () => setNoteTarget(null) }
    );
  };

  // ── Dialog state
  const [detailTarget, setDetailTarget] = useState<FeedbackItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<FeedbackItem | null>(null);

  // ── Table columns
  const columns: ColumnDef<FeedbackItem, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <StatusBadge status={row.original.type} />,
    },
    {
      accessorKey: 'message',
      header: 'Message',
      cell: ({ row }) => (
        <button
          className="text-left max-w-xs truncate hover:underline text-sm"
          onClick={() => setDetailTarget(row.original)}
          title="Click to expand"
        >
          {row.original.message}
        </button>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'submittedBy',
      header: 'Submitted by',
      cell: ({ row }) => {
        const u = row.original.user;
        if (!u) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="text-sm">
            <p className="font-medium leading-tight">{u.username}</p>
            <p className="text-muted-foreground text-xs leading-tight">{u.email}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Submitted',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatRelative(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          item={row.original}
          onStatusChange={handleStatusChange2}
          onOpenNote={(item) => setNoteTarget(item)}
          isUpdating={updateMutation.isPending}
        />
      ),
    },
  ];

  // ── Derived counts
  const counts = data?.counts;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="User feedback items: triage, resolve, and add admin notes."
      />

      {/* KPI row */}
      {isLoading ? (
        <KpiSkeletons />
      ) : counts ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Bug Reports"
            value={counts.byType.Bug}
            icon={Bug}
            description="all time"
          />
          <KpiCard
            label="Ideas"
            value={counts.byType.Idea}
            icon={Lightbulb}
            description="all time"
          />
          <KpiCard
            label="Other"
            value={counts.byType.Other}
            icon={HelpCircle}
            description="all time"
          />
          <KpiCard
            label="New"
            value={counts.byStatus.new}
            icon={Inbox}
            description="needs triage"
          />
          <KpiCard
            label="Triaged"
            value={counts.byStatus.triaged}
            icon={Clock}
            description="in progress"
          />
          <KpiCard
            label="Resolved"
            value={counts.byStatus.resolved}
            icon={CheckCircle}
            description="all time"
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(v) => handleStatusChange(v as FeedbackStatus | 'all')}
        >
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select
          value={typeFilter}
          onValueChange={(v) => handleTypeChange(v as FeedbackType | 'all')}
        >
          <SelectTrigger className="w-[140px]" size="sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {total > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {total} item{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <EmptyState
          title="Failed to load feedback"
          description="Check your connection and try refreshing the page."
          icon={MessageSquare}
        />
      ) : !data || data.feedback.length === 0 ? (
        <EmptyState
          title="No feedback found"
          description={
            statusTab !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting the filters to see more results.'
              : 'No feedback has been submitted yet.'
          }
          icon={MessageSquare}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data.feedback}
          pageSize={PAGE_LIMIT}
          pageCount={pageCount}
          currentPage={page}
          onPageChange={setPage}
        />
      )}

      {/* Detail dialog */}
      <DetailDialog
        item={detailTarget}
        open={detailTarget !== null}
        onOpenChange={(o) => { if (!o) setDetailTarget(null); }}
      />

      {/* Note dialog */}
      <NoteDialog
        item={noteTarget}
        open={noteTarget !== null}
        onOpenChange={(o) => { if (!o) setNoteTarget(null); }}
        onSave={handleNoteSave}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}
