-- Migration 0031: webhook subscriptions — external events can
-- trigger marketplace agents and receive results back on a caller-
-- supplied URL.
--
-- Shape:
--   subscriptions               — one row per registered webhook
--   webhook_delivery_attempts   — one row per attempted delivery
--                                (retries get their own rows)
--
-- Authentication model:
--   Each subscription has a secret the caller generates; the caller
--   signs their trigger POST with HMAC-SHA256 over the body. The
--   platform signs delivery callbacks the same way so subscribers
--   can verify authenticity on receipt. Rotate the secret and old
--   deliveries fail — deliberate.

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Caller-chosen identifier for support debugging ("my-stripe-webhook").
  label TEXT NOT NULL,
  -- Which agent this subscription triggers. FK kept soft (no cascade)
  -- so subscriptions survive agent soft-deletes.
  agent_slug TEXT NOT NULL,
  -- Where the platform POSTs the agent result back to.
  callback_url TEXT NOT NULL,
  -- HMAC-SHA256 secret. Rotated by the subscriber; stored in full.
  -- Not hashed — we need to compute HMAC on both incoming + outgoing.
  secret TEXT NOT NULL,
  -- Owner for tenancy. Ties to creator email today; may migrate to
  -- tenant_id later.
  owner_email TEXT NOT NULL,
  -- Soft-delete via is_active=false. Keeps delivery history intact.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Bookkeeping.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active_agent
  ON webhook_subscriptions (agent_slug, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_webhooks_owner
  ON webhook_subscriptions (owner_email);


CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  -- Copy of the invocation id so we can cross-reference without a join
  -- against the earnings ledger (faster debugging).
  invocation_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  -- HTTP status the callback returned, or NULL on network error.
  response_status INTEGER,
  response_body_preview TEXT,   -- first 500 chars, for audit
  delivered BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_subscription
  ON webhook_delivery_attempts (subscription_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_failed
  ON webhook_delivery_attempts (delivered, attempted_at DESC)
  WHERE delivered = FALSE;
