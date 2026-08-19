ALTER TABLE analysis_embeddings
    ADD COLUMN IF NOT EXISTS metadata JSONB;
