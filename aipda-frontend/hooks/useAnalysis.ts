import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AnalysisResult } from '@/types/api';

export function useAnalysis(datasetId: string | null | undefined) {
  return useQuery<AnalysisResult>({
    queryKey: ['analysis', datasetId],
    queryFn: () => api.getAnalysis(datasetId!),
    enabled: !!datasetId,
    staleTime: Infinity,
  });
}
