-- 009_checkpoint_tables_rls.sql
-- Enable RLS on all four LangGraph checkpoint tables.
--
-- WHY: These tables are written by the backend's direct Postgres connection
-- (the postgres superuser), which bypasses RLS entirely. Enabling RLS here
-- blocks accidental or malicious access to raw agent state via Supabase's
-- REST API using the anon or authenticated role keys.
--
-- No SELECT/INSERT/UPDATE/DELETE policies are added: zero-policy RLS means
-- "deny all" for every non-superuser role. The backend is unaffected.
--
-- Safe to run multiple times (IF NOT EXISTS / idempotent ALTER).

ALTER TABLE IF EXISTS checkpoints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkpoint_blobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkpoint_writes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checkpoint_migrations ENABLE ROW LEVEL SECURITY;

-- Revoke any broad grants that Supabase may have added by default
-- so the anon / authenticated roles cannot even attempt access.
REVOKE ALL ON TABLE checkpoints           FROM anon, authenticated;
REVOKE ALL ON TABLE checkpoint_blobs      FROM anon, authenticated;
REVOKE ALL ON TABLE checkpoint_writes     FROM anon, authenticated;
REVOKE ALL ON TABLE checkpoint_migrations FROM anon, authenticated;
