-- =====================================================================
-- V10 — Federated identity (Google Sign-In) alongside local passwords.
--
-- A user row now records WHICH identity provider owns the credentials:
--   LOCAL  — email + BCrypt password (the existing flow, unchanged)
--   GOOGLE — Google account; no local password is ever stored
--
-- `password` therefore becomes nullable: a Google-only account has no
-- hash. Every existing row is LOCAL, so the backfill is a no-op for
-- current data and the column stays populated for them.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20)  NOT NULL DEFAULT 'LOCAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id   VARCHAR(128) NULL;

-- Google-only accounts have no local hash to store.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- One provider account maps to at most one user. Partial index so the
-- LOCAL rows (provider_id IS NULL) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_provider
    ON users (auth_provider, provider_id)
    WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users (auth_provider);
