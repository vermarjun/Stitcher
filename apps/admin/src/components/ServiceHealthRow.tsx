import { StatusBadge } from './StatusBadge';
import type { ServiceHealth } from '@/lib/types';
import { formatRelative } from '@/lib/format';

interface ServiceHealthRowProps {
  service: ServiceHealth;
}

export function ServiceHealthRow({ service }: ServiceHealthRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusBadge status={service.status} />
        <span className="font-medium capitalize">{service.name}</span>
        {service.detail && (
          <span className="text-xs text-muted-foreground">{service.detail}</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {service.latencyMs !== undefined && (
          <span>{service.latencyMs}ms</span>
        )}
        <span>{formatRelative(service.checkedAt)}</span>
      </div>
    </div>
  );
}
