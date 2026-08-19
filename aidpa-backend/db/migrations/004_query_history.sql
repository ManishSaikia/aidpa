CREATE TABLE IF NOT EXISTS query_history (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id    TEXT        NOT NULL,
    user_id       UUID        NULL,
    question      TEXT        NOT NULL,
    sql_query     TEXT,
    explanation   TEXT,
    total_count   INTEGER,
    total_pages   INTEGER,
    page_size     INTEGER,
    is_error      BOOLEAN     DEFAULT FALSE,
    error_message TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Hot path: "show my query history for this dataset"
CREATE INDEX IF NOT EXISTS idx_query_history_dataset_id
    ON query_history (dataset_id);

-- Partial index ready for user-scoped queries after auth
CREATE INDEX IF NOT EXISTS idx_query_history_user_id
    ON query_history (user_id)
    WHERE user_id IS NOT NULL;
