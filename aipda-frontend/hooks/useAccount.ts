'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type UserStats = Awaited<ReturnType<typeof api.getMyStats>>;

export function useAccount() {
  const { data, isLoading, error, refetch } = useQuery<UserStats>({
    queryKey: ['user-stats'],
    queryFn: () => api.getMyStats(),
    staleTime: 60_000,
    retry: false,
  });
  return { stats: data, isLoading, error, refetch };
}
