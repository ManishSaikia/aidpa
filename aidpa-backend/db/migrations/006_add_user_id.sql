-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 006: Add user_id to datasets and analysis_embeddings
-- Run once in: Supabase → SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE datasets
    ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE analysis_embeddings
    ADD COLUMN IF NOT EXISTS user_id UUID;
