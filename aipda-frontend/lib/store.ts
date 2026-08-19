/**
 * Global app store (Zustand).
 *
 * Holds the active dataset state so every page and component can read
 * the current dataset_id without prop-drilling or URL parsing.
 *
 * Persists to sessionStorage so the dataset survives a page refresh
 * but is cleared when the browser tab closes.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UploadAnalysisResponse } from '@/types/api';

interface DatasetState {
  datasetId: string | null;
  filename: string | null;
  uploadResult: UploadAnalysisResponse | null;

  setDataset: (datasetId: string, filename: string, uploadResult: UploadAnalysisResponse) => void;
  clearDataset: () => void;
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set) => ({
      datasetId: null,
      filename: null,
      uploadResult: null,

      setDataset: (datasetId, filename, uploadResult) =>
        set({ datasetId, filename, uploadResult }),

      clearDataset: () =>
        set({ datasetId: null, filename: null, uploadResult: null }),
    }),
    {
      name: 'aidpa-dataset',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
