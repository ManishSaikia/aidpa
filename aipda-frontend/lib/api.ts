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

// ── Internal helpers ───────────────────────────────────────────────────────────

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

// ── Upload ─────────────────────────────────────────────────────────────────────

export const api = {
  // ── Analysis ────────────────────────────────────────────────────────────────

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

  // ── Text-to-SQL ─────────────────────────────────────────────────────────────

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

  // ── Agent Chat ──────────────────────────────────────────────────────────────

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

  // ── Background Jobs ─────────────────────────────────────────────────────────

  async getJob(jobId: string): Promise<Job> {
    return request<Job>(`/jobs/${jobId}`);
  },

  // ── Embeddings / Vector Store ───────────────────────────────────────────────

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
};
