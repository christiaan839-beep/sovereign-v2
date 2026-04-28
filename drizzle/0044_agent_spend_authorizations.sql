-- Migration 0044: Agent Spend Authorizations + Charges.
--
-- WHY: Round 30 — the first concrete agentic-commerce primitive.
-- Per docs/AGENTIC-COMMERCE.md, this is the "Stripe Issuing for
-- agents" layer: a user grants their agent a bounded, scoped,
-- time-limited authorization to spend money; the platform
-- atomically validates and decrements on each charge.
--
-- This migration is purely about AUTHORIZATION + ACCOUNTING — the
-- actual movement of money happens via Stripe / Yoco / future
-- providers. The platform's job is to make sure no agent EVER
-- spends more than its user authorized, and that every charge has
-- a hash-chained receipt customers can verify.
--
-- SHAPE:
--   agent_spend_authorizations — the user's grant. Fields chosen
--     for the simplest expressive scope:
--       * max_cents — the ceiling
--       * spent_cents — running total (atomic increments)
--       * category_limits — per-merchant-category sub-budgets
--         (e.g. {"saas": 4000, "books": 1000})
--       * allowed_merchants — explicit allowlist (NULL = any)
--       * expires_at — time-bounded (no perpetual blank checks)
--       * revoked_at — user can pull authorization at any time
--
--   agent_spend_charges — one row per attempted/successful charge.
--     Includes idempotency_key for safe retries, receipt_hash for
--     the cryptographic chain, and a reversal_window so
--     "reverse within 24h" is a queryable property of the row.
--
-- SAFETY:
--   * `spent_cents <= max_cents` is enforced at row-write time via
--     a CHECK constraint. Defence-in-depth: if the application logic
--     bugs out, the database refuses the over-spend.
--   * `expires_at` indexed for the cleanup cron.
--   * Idempotency: (authorization_id, idempotency_key) is UNIQUE,
--     so retried requests can never double-charge.

CREATE TABLE IF NOT EXISTS agent_spend_authorizations (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT         NOT NULL,
  -- The agent name this auth is bound to. Mirrors the API-key-scope
  -- pattern (R26): authorization is scoped to a SPECIFIC agent slug,
  -- not to "any agent on this account".
  agent_name          TEXT         NOT NULL,
  -- Hard ceiling in cents. CHECK below ensures spent never exceeds.
  max_cents           INTEGER      NOT NULL,
  spent_cents         INTEGER      NOT NULL DEFAULT 0,
  -- Optional per-category sub-budgets. JSONB so the schema can grow
  -- without a migration. Categories are merchant-category strings
  -- (loosely matching MCC codes).
  category_limits     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Optional explicit merchant allowlist. NULL = any merchant
  -- accepted; empty array = no merchant accepted (revoked-in-place).
  allowed_merchants   JSONB,
  expires_at          TIMESTAMP    NOT NULL,
  -- Time the user revoked. Once set, all future charges 403.
  revoked_at          TIMESTAMP,
  revoke_reason       TEXT,
  -- HITL escalation threshold. Charges above this require approval
  -- via the existing hitl_approval_requests queue. NULL = no
  -- threshold (any charge under max_cents is auto-approved).
  hitl_threshold_cents INTEGER,
  notes               TEXT,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  -- Defence-in-depth: the database itself refuses over-spend even
  -- if the application logic bugs out.
  CONSTRAINT spent_under_max CHECK (spent_cents >= 0 AND spent_cents <= max_cents)
);

-- Find the user's active authorizations + lookup by agent.
CREATE INDEX IF NOT EXISTS idx_agent_spend_auth_user
  ON agent_spend_authorizations (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_spend_auth_agent
  ON agent_spend_authorizations (agent_name, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_spend_auth_expiry
  ON agent_spend_authorizations (expires_at);


CREATE TABLE IF NOT EXISTS agent_spend_charges (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id    UUID         NOT NULL REFERENCES agent_spend_authorizations(id),
  user_id             TEXT         NOT NULL,
  agent_name          TEXT         NOT NULL,
  -- Idempotency key chosen by the agent. (auth_id, idempotency_key)
  -- is UNIQUE so a retried charge produces the same row.
  idempotency_key     TEXT         NOT NULL,
  amount_cents        INTEGER      NOT NULL,
  merchant_name       TEXT         NOT NULL,
  merchant_category   TEXT         NOT NULL,
  -- Free-form metadata for the merchant's own records.
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Status: 'reserved' = decremented but not settled (rare path);
  --         'completed' = fully settled, normal happy path;
  --         'reversed' = reversed within window;
  --         'failed' = rejected (validation failure logged for forensics).
  status              TEXT         NOT NULL,
  -- Hash-chained receipt: receipt_hash = sha256(prev || charge_data).
  -- Verifiable offline by the customer; tampering breaks the chain.
  receipt_hash        TEXT         NOT NULL,
  -- The reversal window (default 24h from creation). After this,
  -- normal dispute process applies, not auto-reversal.
  reversal_window_until  TIMESTAMP NOT NULL,
  reversed_at         TIMESTAMP,
  reversed_by         TEXT,
  reverse_reason      TEXT,
  failed_reason       TEXT,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT amount_positive CHECK (amount_cents > 0),
  CONSTRAINT status_valid CHECK (status IN ('reserved', 'completed', 'reversed', 'failed'))
);

-- Idempotency uniqueness — retried charges never double-spend.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_spend_charges_idempotency
  ON agent_spend_charges (authorization_id, idempotency_key);

-- Forensic + reversal-window indices.
CREATE INDEX IF NOT EXISTS idx_agent_spend_charges_user_recent
  ON agent_spend_charges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_spend_charges_auth
  ON agent_spend_charges (authorization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_spend_charges_reversal
  ON agent_spend_charges (reversal_window_until)
  WHERE status = 'completed' AND reversed_at IS NULL;
