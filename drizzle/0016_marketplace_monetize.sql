-- ═══════════════════════════════════════════════════════════════
-- 0016_marketplace_monetize.sql
-- Adds creator monetisation + verification fields to marketplace_agents
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "marketplace_agents"
  -- Creator identity (links to Clerk user, not email which can change)
  ADD COLUMN IF NOT EXISTS "creator_user_id"          text,
  -- Monetisation
  ADD COLUMN IF NOT EXISTS "price_per_run"             integer NOT NULL DEFAULT 0,  -- in cents (0 = free)
  ADD COLUMN IF NOT EXISTS "stripe_product_id"         text,
  ADD COLUMN IF NOT EXISTS "stripe_price_id"           text,
  ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" text,
  -- Usage stats (denormalised for fast leaderboard queries)
  ADD COLUMN IF NOT EXISTS "total_run_count"           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weekly_run_count"          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_cents"             integer NOT NULL DEFAULT 0,  -- total gross
  ADD COLUMN IF NOT EXISTS "creator_revenue_cents"     integer NOT NULL DEFAULT 0,  -- 70% share
  -- Verification pipeline
  ADD COLUMN IF NOT EXISTS "verification_status"       text NOT NULL DEFAULT 'pending',
  -- values: pending | in_review | verified | rejected | suspended
  ADD COLUMN IF NOT EXISTS "verified_at"               timestamp,
  ADD COLUMN IF NOT EXISTS "test_run_passed"           boolean,
  ADD COLUMN IF NOT EXISTS "safety_score"              integer,  -- 0-100 from 5-layer check
  ADD COLUMN IF NOT EXISTS "rejection_reason"          text,
  -- Discovery
  ADD COLUMN IF NOT EXISTS "tags"                      text NOT NULL DEFAULT '[]',  -- JSON array
  ADD COLUMN IF NOT EXISTS "featured"                  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featured_at"               timestamp;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_marketplace_creator"      ON "marketplace_agents" ("creator_user_id");
CREATE INDEX IF NOT EXISTS "idx_marketplace_category"     ON "marketplace_agents" ("category");
CREATE INDEX IF NOT EXISTS "idx_marketplace_status"       ON "marketplace_agents" ("verification_status");
CREATE INDEX IF NOT EXISTS "idx_marketplace_featured"     ON "marketplace_agents" ("featured") WHERE featured = true;
CREATE INDEX IF NOT EXISTS "idx_marketplace_runs"         ON "marketplace_agents" ("total_run_count" DESC);
CREATE INDEX IF NOT EXISTS "idx_marketplace_revenue"      ON "marketplace_agents" ("creator_revenue_cents" DESC);
