-- 011_api_cost_log.sql
-- Tracks every Gemini API call: model, tokens, calculated cost.
-- Used by GET /admin/costs and the account page cost dashboard.

CREATE TABLE IF NOT EXISTS api_cost_log (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID,
    model         TEXT          NOT NULL,
    endpoint      TEXT,
    input_tokens  INTEGER       NOT NULL DEFAULT 0,
    output_tokens INTEGER       NOT NULL DEFAULT 0,
    cost_usd      NUMERIC(12,8) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_cost_log_user_day_idx
    ON api_cost_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS api_cost_log_day_idx
    ON api_cost_log (created_at DESC);

CREATE INDEX IF NOT EXISTS api_cost_log_endpoint_idx
    ON api_cost_log (endpoint);
