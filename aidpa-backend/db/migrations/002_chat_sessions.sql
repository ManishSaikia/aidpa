CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id   TEXT        PRIMARY KEY,
    dataset_id   TEXT        NOT NULL,
    user_id      UUID        NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hot path: "load all sessions for this dataset"
CREATE INDEX IF NOT EXISTS idx_chat_sessions_dataset_id
    ON chat_sessions (dataset_id);

-- Partial index for future user-scoped queries — zero overhead until non-null
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
    ON chat_sessions (user_id)
    WHERE user_id IS NOT NULL;
