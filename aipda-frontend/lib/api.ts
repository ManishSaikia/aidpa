import type {
  AgentChatRequest,
  AgentChatResponse,
  AnalysisResult,
  AnomalyResult,
  DatasetInfo,
  EmbedResponse,
  Job,
  PaginateRequest,
  PersistedMessage,
  PruneResponse,
  QueryHistoryRecord,
  QueryRequest,
  QueryResponse,
  SessionInfo,
  SessionListItem,
  SimilarDatasetsResponse,
} from '@/types/api';
import { supabase } from '@/lib/supabase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {
      detail = res.statusText || detail;
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

async function requestAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const wrapped = await request<{ success: boolean; data: T; error: string | null }>(path, options);
  return wrapped.data;
}

// â”€â”€ Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const api = {
  // â”€â”€ Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getAnalysis(datasetId: string): Promise<AnalysisResult> {
    return requestAPI<AnalysisResult>(`/datasets/${datasetId}/analysis`);
  },

  async getAnomalies(datasetId: string, method?: 'zscore' | 'iqr'): Promise<AnomalyResult> {
    const params = method ? `?method=${method}` : '';
    return requestAPI<AnomalyResult>(`/datasets/${datasetId}/anomalies${params}`);
  },

  async listDatasets(): Promise<DatasetInfo[]> {
    return requestAPI<DatasetInfo[]>('/datasets/');
  },

  async getDataset(datasetId: string): Promise<DatasetInfo> {
    return requestAPI<DatasetInfo>(`/datasets/${datasetId}`);
  },

  // â”€â”€ Text-to-SQL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async query(req: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
    return request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(req),
      signal,
    });
  },

  async paginateQuery(req: PaginateRequest, signal?: AbortSignal): Promise<QueryResponse> {
    return request<QueryResponse>('/query/execute', {
      method: 'POST',
      body: JSON.stringify(req),
      signal,
    });
  },

  async listQueryHistory(datasetId: string): Promise<QueryHistoryRecord[]> {
    return request<QueryHistoryRecord[]>(`/query/history?dataset_id=${datasetId}`);
  },

  // â”€â”€ Agent Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async agentChat(req: AgentChatRequest, signal?: AbortSignal): Promise<AgentChatResponse> {
    return request<AgentChatResponse>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify(req),
      signal,
    });
  },

  async listSessions(datasetId: string): Promise<SessionListItem[]> {
    return request<SessionListItem[]>(`/agent/sessions?dataset_id=${datasetId}`);
  },

  async getSessionMessages(sessionId: string): Promise<{ session_id: string; messages: PersistedMessage[] }> {
    return request(`/agent/sessions/${sessionId}/messages`);
  },

  async getSession(sessionId: string): Promise<SessionInfo> {
    return request<SessionInfo>(`/agent/sessions/${sessionId}`);
  },

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return request(`/agent/sessions/${sessionId}`, { method: 'DELETE' });
  },

  // â”€â”€ Background Jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getJob(jobId: string): Promise<Job> {
    return request<Job>(`/jobs/${jobId}`);
  },

  // â”€â”€ Embeddings / Vector Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async embedDataset(datasetId: string): Promise<EmbedResponse> {
    return request<EmbedResponse>(`/datasets/${datasetId}/embed`, { method: 'POST' });
  },

  async getSimilarDatasets(datasetId: string, topK = 5): Promise<SimilarDatasetsResponse> {
    return request<SimilarDatasetsResponse>(
      `/datasets/${datasetId}/similar?top_k=${topK}`
    );
  },

  async pruneEmbeddings(olderThanDays = 90): Promise<PruneResponse> {
    return request<PruneResponse>(
      `/datasets/embeddings/prune?older_than_days=${olderThanDays}`,
      { method: 'DELETE' }
    );
  },

  // ── Account / User ──────────────────────────────────────────────────────────

  async getMyStats(): Promise<{
    user_id: string; email: string; is_admin: boolean;
    storage_used_bytes: number; storage_quota_bytes: number;
    storage_used_mb: number; storage_quota_mb: number; storage_percent: number;
    datasets_count: number; sessions_count: number; queries_count: number;
  }> {
    return request('/user/me/stats');
  },

  async listAllUsers(): Promise<{
    user_id: string; email: string; display_name: string;
    created_at: string; last_sign_in: string; is_admin: boolean;
    storage_used_bytes: number; storage_used_mb: number;
    storage_quota_mb: number; storage_percent: number; datasets_count: number;
  }[]> {
    return request('/user/admin/users');
  },

  async deleteMyAccount(): Promise<{ message: string; deleted: Record<string, number> }> {
    return request('/user/me', { method: 'DELETE' });
  },

  async adminDeleteUser(userId: string): Promise<{ message: string; deleted: Record<string, number> }> {
    return request(`/user/admin/users/${userId}`, { method: 'DELETE' });
  },
};
