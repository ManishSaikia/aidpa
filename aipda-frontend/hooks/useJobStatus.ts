import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Job, JobStatus } from '@/types/api';

const TERMINAL: JobStatus[] = ['done', 'failed'];
const POLL_INTERVAL_MS = 2000;

export function useJobStatus(jobId: string | null | undefined) {
  return useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),

    enabled: !!jobId,

    // Poll every 2 seconds
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.includes(status)) return false;
      return POLL_INTERVAL_MS;
    },

    placeholderData: (prev) => prev,
  });
}
