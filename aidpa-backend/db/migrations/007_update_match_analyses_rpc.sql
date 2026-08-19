-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 007: Update match_analyses RPC to support per-user filtering
-- Run once in: Supabase → SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_analyses(
  query_embedding  vector(768),
  match_count      int     DEFAULT 5,
  exclude_id       text    DEFAULT NULL,
  filter_user_id   uuid    DEFAULT NULL
)
RETURNS TABLE (
  dataset_id   text,
  filename     text,
  similarity   float,
  text_digest  text
)
LANGUAGE sql
AS $$
  SELECT
    dataset_id,
    filename,
    1 - (embedding <=> query_embedding) AS similarity,
    text_digest
  FROM   analysis_embeddings
  WHERE  (exclude_id       IS NULL OR dataset_id <> exclude_id)
    AND  (filter_user_id   IS NULL OR user_id     = filter_user_id)
  ORDER  BY embedding <=> query_embedding
  LIMIT  match_count;
$$;
