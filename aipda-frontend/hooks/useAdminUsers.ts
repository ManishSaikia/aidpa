'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AdminUser = Awaited<ReturnType<typeof api.listAllUsers>>[number];

export function useAdminUsers(enabled: boolean) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.listAllUsers(),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  const deleteUser = async (userId: string): Promise<void> => {
    setDeletingId(userId);
    setDeleteError(null);
    try {
      await api.adminDeleteUser(userId);
      qc.setQueryData<AdminUser[]>(['admin-users'], (prev) =>
        (prev ?? []).filter((u) => u.user_id !== userId)
      );
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
      throw err;
    } finally {
      setDeletingId(null);
    }
  };

  return { users: data ?? [], isLoading, error, deletingId, deleteError, deleteUser };
}
