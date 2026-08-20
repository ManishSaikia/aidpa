'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AdminCosts = Awaited<ReturnType<typeof api.getAdminCosts>>;

export function useAdminCosts(enabled: boolean) {
  return useQuery<AdminCosts>({
    queryKey: ['admin-costs'],
    queryFn: () => api.getAdminCosts(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
