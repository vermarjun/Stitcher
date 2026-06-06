import { useQuery } from '@tanstack/react-query';
import api from './api';

/**
 * Thin wrapper around useQuery for admin API calls.
 * useAdminQuery(key, path, params?) calls api.get(path, { params }).then(r => r.data)
 */
export function useAdminQuery<T = unknown>(
  key: string | readonly unknown[],
  path: string,
  params?: Record<string, unknown>
) {
  return useQuery<T>({
    queryKey: Array.isArray(key) ? key : [key, params],
    queryFn: () => api.get<T>(path, { params }).then((r) => r.data),
  });
}
