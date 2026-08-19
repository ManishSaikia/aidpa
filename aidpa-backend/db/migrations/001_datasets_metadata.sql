CREATE TABLE IF NOT EXISTS datasets (
    dataset_id              TEXT        PRIMARY KEY,
    filename                TEXT        NOT NULL,
    path                    TEXT        NOT NULL,
    size_bytes              INTEGER     NOT NULL,
    row_count               INTEGER,
    column_count            INTEGER,
    columns                 JSONB,
    sample_rows             JSONB,
    date_columns_corrected  JSONB,
    ingested_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Index for the UI list view 
CREATE INDEX IF NOT EXISTS idx_datasets_ingested_at
    ON datasets (ingested_at DESC);
