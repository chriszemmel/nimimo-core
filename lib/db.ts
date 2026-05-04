import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import { logger } from "./logger"

const log = logger("db")

let _sql: NeonQueryFunction<false, false> | null = null

export function sql(): NeonQueryFunction<false, false> {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!)
  return _sql
}

// ─── Auto-migrations ────────────────────────────────────────────────────
// Idempotent schema migrations that run once per process lifetime.

let _migrated = false

export async function ensureMigrations(): Promise<void> {
  if (_migrated) return
  _migrated = true
  const db = sql()
  try {
    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_identity BOOLEAN DEFAULT FALSE`
    await db`ALTER TABLE identities ADD COLUMN IF NOT EXISTS bio TEXT`
    await db`ALTER TABLE identities ADD COLUMN IF NOT EXISTS avatar_url TEXT`
    await db`ALTER TABLE identities ADD COLUMN IF NOT EXISTS profile_template TEXT NOT NULL DEFAULT 'classic'`
    await db`ALTER TABLE identities ADD COLUMN IF NOT EXISTS profile_palette TEXT NOT NULL DEFAULT 'default'`
    await db`ALTER TABLE identities ADD COLUMN IF NOT EXISTS badges JSONB NOT NULL DEFAULT '[]'`
    await db`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id            SERIAL PRIMARY KEY,
        slug          TEXT NOT NULL UNIQUE,
        title         TEXT NOT NULL,
        subtitle      TEXT NOT NULL,
        description   TEXT NOT NULL,
        author        TEXT NOT NULL DEFAULT 'nimimo',
        published_at  DATE NOT NULL,
        tags          JSONB NOT NULL DEFAULT '[]',
        cta           JSONB,
        sections      JSONB NOT NULL DEFAULT '[]',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    await db`
      CREATE TABLE IF NOT EXISTS ownership_users (
        ownership_id  UUID NOT NULL,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        linked_at     TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY (ownership_id, user_id)
      )
    `
    // Backfill has_identity for users who already have ownerships
    await db`
      UPDATE users SET has_identity = true
      WHERE has_identity = false
        AND id IN (SELECT DISTINCT user_id FROM ownership_users)
    `
    // Intent layer: structured unsigned payment requests for agent/app coordination
    await db`
      CREATE TABLE IF NOT EXISTS intents (
        id              TEXT PRIMARY KEY,
        from_identifier TEXT,
        to_handle       TEXT NOT NULL,
        to_address      TEXT NOT NULL,
        chain           TEXT NOT NULL CHECK (chain IN ('bitcoin', 'ethereum', 'solana')),
        asset           TEXT NOT NULL CHECK (asset IN ('BTC', 'ETH', 'SOL')),
        amount          TEXT NOT NULL,
        memo            TEXT,
        status          TEXT NOT NULL DEFAULT 'awaiting_signature'
                        CHECK (status IN ('awaiting_signature', 'signed', 'completed', 'expired', 'cancelled')),
        tx_hash         TEXT,
        expires_at      TIMESTAMPTZ NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
  } catch (e) {
    log.warn("Auto-migration failed (non-fatal)", { error: e })
  }
}
