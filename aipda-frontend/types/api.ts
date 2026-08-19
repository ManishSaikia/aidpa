// ── Analysis ─────────────────────────────────────────────────────────────────

export interface TopValue {
  value: string | number;
  count: number;
}

export interface ColumnStats {
  inferred_type: 'numeric' | 'categorical';
  null_count: number;
  null_pct: number;
  flagged_quality: boolean;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  zscore_outlier_count?: number;
  zscore_outlier_pct?: number;
  iqr_outlier_count?: number;
  iqr_outlier_pct?: number;
  cardinality?: number;
  top_values?: TopValue[];
}

export interface AnalysisResult {
  dataset_id: string;
  filename: string;
  total_rows: number;
  total_columns: number;
  numeric_columns: number;
  categorical_columns: number;
  duplicate_rows: number;
  null_threshold_pct: number;
  high_null_columns: string[];
  columns: Record<string, ColumnStats>;
}

export interface DatasetInfo {
  dataset_id: string;
  filename: string;
  path: string;
  size_bytes: number;
}

export interface UploadAnalysisResponse {
  dataset_id: string;
  message: string;
  filename: string;
  columns: string[];
  rows: number;
  dtype: Record<string, string>;
  nulls: Record<string, number>;
  schema: Record<string, string>;
}

export interface UploadResponse {
  success: boolean;
  data: UploadAnalysisResponse;
  error: string | null;
}

// ── Text-to-SQL ───────────────────────────────────────────────────────────────

export interface QueryResponse {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  explanation?: string;
}

export interface QueryRequest {
  dataset_id: string;
  question: string;
  page?: number;
  page_size?: number;
}

export interface PaginateRequest {
  dataset_id: string;
  sql: string;
  page: number;
  page_size: number;
}

export interface QueryHistoryRecord {
  id: string;
  question: string;
  sql_query?: string;
  explanation?: string;
  total_count?: number;
  total_pages?: number;
  page_size?: number;
  is_error: boolean;
  error_message?: string;
  created_at: string;
}

// ── Agent Chat ────────────────────────────────────────────────────────────────

export interface AgentChatRequest {
  dataset_id: string;
  question: string;
  is_new_session: boolean;
  session_id?: string;
}

export interface AgentChatResponse {
  session_id: string;
  answer: string;
}

export interface SessionInfo {
  session_id: string;
  dataset_id: string;
  title?: string;
  created_at: string;
  last_used_at: string;
}

export interface SessionListItem {
  session_id: string;
  title: string;
  created_at: string;
  last_used_at: string;
  message_count: number;
}

export interface PersistedMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

// ── Background Jobs ───────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  job_id: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  created_at: string;
}

// ── Embeddings ────────────────────────────────────────────────────────────────

export interface EmbedResponse {
  dataset_id: string;
  filename: string;
  digest_preview: string;
  embedding_dims: number;
  message: string;
}

export interface SimilarDataset {
  dataset_id: string;
  filename: string;
  similarity: number;
  text_digest: string;
}

export interface SimilarDatasetsResponse {
  query_dataset_id: string;
  results: SimilarDataset[];
}

export interface PruneResponse {
  deleted_count: number;
  older_than_days: number;
  message: string;
}

// ── Anomalies ─────────────────────────────────────────────────────────────────

export interface AnomalyColumnResult {
  flagged_rows: number[];
  count: number;
}

export interface AnomalyResult {
  dataset_id: string;
  numeric_columns_checked: string[];
  methods_applied: string[];
  results: {
    zscore?: Record<string, AnomalyColumnResult>;
    iqr?: Record<string, AnomalyColumnResult>;
  };
}

// ── Narration / Chat ──────────────────────────────────────────────────────────

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
}

// ── UI State ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress?: number;
  result?: AnalysisResult;
  error?: string;
}
