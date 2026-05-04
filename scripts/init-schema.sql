-- Foundational schema for a fresh nimimo deployment.
--
-- Run this ONCE against an empty database. Everything else (column
-- additions, secondary tables like blog_posts and intents, has_identity
-- backfill) is applied automatically at runtime by lib/db.ts:ensureMigrations,
-- which is idempotent and safe to re-run on every cold start.

-- pgcrypto provides gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users + NextAuth tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at   TIMESTAMP WITH TIME ZONE,
  canonical_user  BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL,
  provider             TEXT NOT NULL,
  provider_account_id  TEXT NOT NULL,
  refresh_token        TEXT,
  access_token         TEXT,
  expires_at           BIGINT,
  token_type           TEXT,
  scope                TEXT,
  id_token             TEXT,
  session_state        TEXT,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier  TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  expires     TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id     ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token       ON sessions(session_token);

-- ─── Identities (handle ↔ ownership_id) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS identities (
  identity_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        TEXT UNIQUE NOT NULL,
  ownership_id  UUID UNIQUE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identities_handle        ON identities(handle);
CREATE INDEX IF NOT EXISTS idx_identities_ownership_id  ON identities(ownership_id);

-- ─── Public addresses (server stores, never derives) ──────────────────────

CREATE TABLE IF NOT EXISTS ownership_public_addresses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ownership_id      UUID NOT NULL,
  ownership_version TEXT NOT NULL,
  chain             TEXT NOT NULL,
  address           TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(ownership_id, ownership_version, chain)
);

CREATE INDEX IF NOT EXISTS idx_addresses_ownership_id  ON ownership_public_addresses(ownership_id);
CREATE INDEX IF NOT EXISTS idx_addresses_address       ON ownership_public_addresses(address);
