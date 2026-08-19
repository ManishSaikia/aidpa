-- 008_add_audit_log.sql
-- Non-destructive. Safe to run multiple times.

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL,
    action       TEXT        NOT NULL,
    resource_id  TEXT,
    resource_type TEXT,
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_created_idx
    ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_resource_idx
    ON audit_log (resource_id)
    WHERE resource_id IS NOT NULL;
