-- ═══════════════════════════════════════════════════════════════════
-- 0018: Credit System — balance tracking, transactions, and holds
-- ═══════════════════════════════════════════════════════════════════
--
-- Three tables, one purpose: account for every cent that moves through
-- an agent run without locking a row for the duration of the request.
--
--   user_credits          — current balance per user
--   credit_transactions   — append-only ledger of every +/- delta
--   credit_holds          — reservations during in-flight runs, auto-
--                           expire if the agent never completes
--
-- Balances live in CENTS (integer). No float arithmetic, no rounding
-- drift. Conversion to/from USD happens in the application layer.
--
-- RLS: users can only see their own rows. Service-role bypasses RLS
-- for admin/webhook paths. If RLS is already configured globally
-- via migration 0005, this migration only adds policies for the new
-- tables.
-- ═══════════════════════════════════════════════════════════════════

-- ── user_credits ──────────────────────────────────────────────────
-- One row per user. Updated by the app, not by triggers — we want
-- explicit writes so Sentry catches any unexpected balance changes.

CREATE TABLE IF NOT EXISTS user_credits (
  user_id            TEXT PRIMARY KEY,
  balance_cents      INTEGER NOT NULL DEFAULT 0,
  plan_tier          TEXT NOT NULL DEFAULT 'free',
  last_topped_up_at  TIMESTAMP,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_credits_balance_non_negative CHECK (balance_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_credits_tier ON user_credits(plan_tier);

-- ── credit_transactions ───────────────────────────────────────────
-- Append-only ledger. Every balance change MUST have a matching row here
-- so we can reconstruct the balance from zero at any point in time.
-- This is the audit trail for SOC 2 and also the user-facing history.

CREATE TABLE IF NOT EXISTS credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  delta_cents     INTEGER NOT NULL,
  reason          TEXT NOT NULL, -- 'topup' | 'agent_run' | 'refund' | 'adjustment' | 'promo'
  agent_id        TEXT,           -- NULL for non-run reasons
  run_id          UUID,           -- playbook_runs.id when applicable
  hold_id         UUID,           -- credit_holds.id when a hold is captured
  metadata        JSONB DEFAULT '{}'::JSONB,
  created_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT credit_tx_reason_known CHECK (
    reason IN ('topup', 'agent_run', 'refund', 'adjustment', 'promo', 'hold_capture', 'hold_release')
  )
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_agent ON credit_transactions(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_tx_run ON credit_transactions(run_id) WHERE run_id IS NOT NULL;

-- ── credit_holds ──────────────────────────────────────────────────
-- Pre-reserve credits before a run starts so concurrent requests can't
-- oversubscribe. On success the hold is captured (converted to a
-- transaction). On failure or timeout it's released (balance restored).
-- TTL is enforced by a periodic cleanup job, not a DB trigger.

CREATE TABLE IF NOT EXISTS credit_holds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  agent_run_id  UUID,
  expires_at    TIMESTAMP NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT NOW(),
  captured_at   TIMESTAMP,
  released_at   TIMESTAMP,
  CONSTRAINT credit_holds_status_known CHECK (
    status IN ('active', 'captured', 'released', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_credit_holds_user ON credit_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_holds_expires ON credit_holds(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_holds_run ON credit_holds(agent_run_id) WHERE agent_run_id IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────
-- Users can SELECT only their own rows. All writes go through service-
-- role (the app's DATABASE_URL has bypass privileges).

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_credits_select_own ON user_credits;
CREATE POLICY user_credits_select_own ON user_credits
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

DROP POLICY IF EXISTS credit_tx_select_own ON credit_transactions;
CREATE POLICY credit_tx_select_own ON credit_transactions
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

DROP POLICY IF EXISTS credit_holds_select_own ON credit_holds;
CREATE POLICY credit_holds_select_own ON credit_holds
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

-- ── updated_at trigger for user_credits ───────────────────────────

CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_credits_updated_at ON user_credits;
CREATE TRIGGER trigger_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_user_credits_updated_at();
