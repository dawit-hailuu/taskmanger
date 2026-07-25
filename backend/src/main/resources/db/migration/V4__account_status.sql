-- =====================================================================
-- V4 — Replace the boolean `enabled` flag with a richer account_status
-- ---------------------------------------------------------------------
--   PENDING     : registered, email not yet verified (cannot sign in)
--   ACTIVE      : verified and allowed to sign in
--   DEACTIVATED : disabled by an administrator
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- Backfill from the previous flags: deactivated accounts stay disabled,
-- verified accounts become ACTIVE, everyone else is PENDING.
UPDATE users
SET account_status = CASE
        WHEN enabled = FALSE      THEN 'DEACTIVATED'
        WHEN email_verified = TRUE THEN 'ACTIVE'
        ELSE 'PENDING'
    END
WHERE TRUE;

ALTER TABLE users DROP COLUMN IF EXISTS enabled;
