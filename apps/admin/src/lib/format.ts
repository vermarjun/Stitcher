import { formatDistanceToNow, isValid } from 'date-fns';

/** Format a raw number with locale separators, optional compact suffix (K/M/B) */
export function formatNumber(value: number, compact = false): string {
  if (compact) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN').format(value);
}

/** Format bytes to a human-readable string (B / KB / MB / GB / TB) */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format a duration in milliseconds to a human-readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Format an amount in INR */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a date relative to now (e.g. "2 hours ago") */
export function formatRelative(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined || date === '') return '—';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!isValid(d) || isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}
