-- =====================================================================
-- V12 — Track each user's last successful sign-in.
--
-- LoginHistory already stores every attempt as an audit trail, but reading
-- "when did this user last actually sign in" out of that table means a
-- MAX(created_at) query filtered to successes. A denormalised column on the
-- user row itself is the simpler read path for the common case (e.g. an
-- admin user list), and it's updated in exactly one place
-- (AuthService.issueSession) regardless of which provider signed the user in.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;
