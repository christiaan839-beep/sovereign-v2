-- Migration 0028: creator earnings ledger.
--
-- Two tables:
--
--   creator_earnings         — immutable append-only ledger. One row
--                              per agent invocation. Carries the 70/30
--                              split fields (gross, creator, platform).
--
--   creator_payout_batches   — monthly rollup of PAID earnings into a
--                              Stripe transfer. Many earnings rows
--                              reference one batch via payout_batch_id.
--
-- The split (70% creator / 30% platform) is stored as cents per row
-- rather than computed at query time. Reasons:
--   1. Future-proof — if we change the split for a cohort, historical
--      rows keep their original amounts.
--   2. Fast dashboards — SUM(creator_cents) WHERE ... is O(rows),
--      no CPU for arithmetic.
--   3. Auditable — every row shows the exact amounts at time of
--      recording, independent of code changes.

CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
  creator_email TEXT NOT NULL,
  invocation_id TEXT,                                  -- external ref (playbook run, etc.)

  -- 70/30 split baked in; sum must equal gross for audit.
  gross_cents      INTEGER NOT NULL CHECK (gross_cents >= 0),
  creator_cents    INTEGER NOT NULL CHECK (creator_cents >= 0),
  platform_cents   INTEGER NOT NULL CHECK (platform_cents >= 0),

  status TEXT NOT NULL DEFAULT 'pending',              -- pending | paid | reversed
  payout_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_earnings_creator
  ON creator_earnings (creator_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_earnings_agent
  ON creator_earnings (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_earnings_status
  ON creator_earnings (status);

CREATE INDEX IF NOT EXISTS idx_earnings_batch
  ON creator_earnings (payout_batch_id);

-- Idempotency: a single invocation should only credit once. Allow NULL
-- (for earnings credited without a source ID — backfills etc.).
CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_invocation_unique
  ON creator_earnings (invocation_id)
  WHERE invocation_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS creator_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_email TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',              -- pending | sent | failed
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batch_creator
  ON creator_payout_batches (creator_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_batch_status
  ON creator_payout_batches (status);
