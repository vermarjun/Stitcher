import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { formatRelative } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RlhfLesson {
  id: string;
  lesson: string;
  sourcePrompt?: string | null;
  error?: string | null;
  jobId?: string | null;
  createdAt: string;
  origin: 'manual' | 'auto';
}

type LessonsApiResponse =
  | { lessons: RlhfLesson[] }
  | RlhfLesson[];

function normalizeLessons(data: LessonsApiResponse): RlhfLesson[] {
  if (Array.isArray(data)) return data;
  if (data && 'lessons' in data && Array.isArray(data.lessons)) return data.lessons;
  return [];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INJECTED_LIMIT = 25;
const QUERY_KEY = ['admin/rlhf/lessons'] as const;

// ── Origin badge ───────────────────────────────────────────────────────────────

function OriginBadge({ origin }: { origin: 'manual' | 'auto' }) {
  return origin === 'auto' ? (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0"
    >
      auto
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-0"
    >
      manual
    </Badge>
  );
}

// ── Add lesson form ────────────────────────────────────────────────────────────

function AddLessonForm({ onAdded }: { onAdded: () => void }) {
  const [text, setText] = useState('');

  const mutation = useMutation({
    mutationFn: (lesson: string) =>
      api.post('/admin/rlhf/lessons', { lesson }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Lesson added to memory');
      setText('');
      onAdded();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to add lesson';
      toast.error(msg);
    },
  });

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-medium">Add a lesson</p>
        </div>
        <textarea
          className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          placeholder="e.g. Never use plt.show() inside Manim scenes — it blocks the renderer. Always close all axes handles after use."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={mutation.isPending}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleAdd}
            disabled={mutation.isPending || !text.trim()}
          >
            {mutation.isPending ? (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Adding…</>
            ) : (
              <><Plus className="h-3.5 w-3.5" />Add lesson</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────────

interface EditDialogProps {
  lesson: RlhfLesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function EditDialog({ lesson, open, onOpenChange, onSaved }: EditDialogProps) {
  const [text, setText] = useState(lesson?.lesson ?? '');

  const handleOpenChange = (o: boolean) => {
    if (o) setText(lesson?.lesson ?? '');
    onOpenChange(o);
  };

  const mutation = useMutation({
    mutationFn: (newLesson: string) =>
      api.patch(`/admin/rlhf/lessons/${lesson!.id}`, { lesson: newLesson }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Lesson updated');
      onOpenChange(false);
      onSaved();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update lesson';
      toast.error(msg);
    },
  });

  if (!lesson) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit lesson
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <OriginBadge origin={lesson.origin} />
            <span className="text-xs text-muted-foreground">{formatRelative(lesson.createdAt)}</span>
          </div>
          <textarea
            className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={mutation.isPending}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate(text.trim())}
            disabled={mutation.isPending || !text.trim() || text.trim() === lesson.lesson}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm dialog ──────────────────────────────────────────────────────

interface DeleteDialogProps {
  lesson: RlhfLesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteDialog({ lesson, open, onOpenChange, onDeleted }: DeleteDialogProps) {
  const mutation = useMutation({
    mutationFn: () =>
      api.delete(`/admin/rlhf/lessons/${lesson!.id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Lesson removed from memory');
      onOpenChange(false);
      onDeleted();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete lesson';
      toast.error(msg);
    },
  });

  if (!lesson) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Remove lesson
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This will permanently remove the lesson from memory. The coder won't see it in future
            generations.
          </p>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm line-clamp-4">
            {lesson.lesson}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Lesson card ────────────────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: RlhfLesson;
  index: number;
  injectedLimit: number;
  onEdit: (lesson: RlhfLesson) => void;
  onDelete: (lesson: RlhfLesson) => void;
}

function LessonCard({ lesson, index, injectedLimit, onEdit, onDelete }: LessonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContext = !!(lesson.sourcePrompt || lesson.error);
  const isInjected = index < injectedLimit;

  return (
    <Card className={!isInjected ? 'opacity-60' : undefined}>
      <CardContent className="pt-4 space-y-2">
        {/* Top row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {lesson.lesson}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(lesson)}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(lesson)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <OriginBadge origin={lesson.origin} />
          {isInjected ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
              <Check className="h-2.5 w-2.5" />
              injected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              <X className="h-2.5 w-2.5" />
              pruned (too old)
            </span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {formatRelative(lesson.createdAt)}
          </span>
          {lesson.jobId && (
            <span className="text-[10px] font-mono text-muted-foreground">
              job: {lesson.jobId.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* Collapsible context (auto-learned lessons) */}
        {hasContext && (
          <>
            <Separator />
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />Hide context</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />Show source context</>
              )}
            </button>

            {expanded && (
              <div className="space-y-2 pt-1">
                {lesson.sourcePrompt && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Source prompt
                    </p>
                    <pre className="rounded bg-muted/50 border px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {lesson.sourcePrompt}
                    </pre>
                  </div>
                )}
                {lesson.error && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Error that triggered learning
                    </p>
                    <pre className="rounded bg-destructive/10 border border-destructive/20 px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-destructive">
                      {lesson.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CoderMemoryPage() {
  const qc = useQueryClient();

  const { data: raw, isLoading, isError, refetch } = useQuery<LessonsApiResponse>({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api.get<LessonsApiResponse>('/admin/rlhf/lessons').then((r) => r.data),
  });

  const lessons = raw ? normalizeLessons(raw) : [];

  const invalidate = () => void qc.invalidateQueries({ queryKey: QUERY_KEY });

  // ── Dialog state
  const [editTarget, setEditTarget] = useState<RlhfLesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RlhfLesson | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coder Memory"
        description={'Mistakes the coder learned from past failed generations. They\'re injected into every future generation as "past mistakes to avoid". Review and prune bad ones; add your own.'}
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {/* Info banner */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-3">
        <Brain className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            Only the <span className="font-semibold">most-recent {INJECTED_LIMIT} lessons</span> are
            injected per generation — older ones are silently skipped. Prune bad or outdated entries
            so the most useful lessons stay within the limit.
          </p>
          {!isLoading && !isError && (
            <p className="text-xs text-muted-foreground">
              {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} in memory
              {lessons.length > INJECTED_LIMIT && (
                <span className="text-amber-600 dark:text-amber-400 ml-1.5">
                  — {lessons.length - INJECTED_LIMIT} will be skipped (below the cut-off)
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Add lesson */}
      <AddLessonForm onAdded={invalidate} />

      {/* List */}
      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="font-semibold text-sm">Failed to load lessons</p>
          <p className="text-xs text-muted-foreground">
            Make sure the API is running and the endpoint{' '}
            <span className="font-mono">/admin/rlhf/lessons</span> is available.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-10 text-center space-y-2">
          <Brain className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-semibold text-sm">No lessons yet</p>
          <p className="text-xs text-muted-foreground">
            Add a lesson above, or run a generation and let the coder learn from a failure.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, idx) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={idx}
              injectedLimit={INJECTED_LIMIT}
              onEdit={(l) => { setEditTarget(l); }}
              onDelete={(l) => { setDeleteTarget(l); }}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EditDialog
        lesson={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        onSaved={invalidate}
      />
      <DeleteDialog
        lesson={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        onDeleted={invalidate}
      />
    </div>
  );
}
