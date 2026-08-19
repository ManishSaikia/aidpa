-- 010_audit_log_nullable_user_id.sql
-- Make audit_log.user_id nullable so records can be anonymized on account
-- deletion rather than hard-deleted. The event is preserved for compliance;
-- only the identity (user_id) is erased. Safe to run multiple times.

ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;
