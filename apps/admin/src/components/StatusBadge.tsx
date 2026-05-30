import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_MAP: Record<string, { variant: StatusVariant; className?: string }> = {
  // Job statuses
  queued: { variant: 'secondary' },
  planning: { variant: 'secondary', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  rendering: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  concatenating: { variant: 'secondary', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  uploading: { variant: 'secondary', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  complete: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  failed: { variant: 'destructive' },
  cancelled: { variant: 'outline', className: 'text-muted-foreground' },
  // Service health
  up: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  degraded: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  down: { variant: 'destructive' },
  // Feedback status
  new: { variant: 'secondary', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  triaged: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  resolved: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  // Payment status
  paid: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  created: { variant: 'secondary', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  refunded: { variant: 'outline', className: 'text-muted-foreground' },
  // User active status
  active: { variant: 'secondary', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  banned: { variant: 'destructive' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status.toLowerCase()] ?? { variant: 'secondary' as StatusVariant };
  return (
    <Badge
      variant={config.variant}
      className={cn('capitalize', config.className, className)}
    >
      {status}
    </Badge>
  );
}
