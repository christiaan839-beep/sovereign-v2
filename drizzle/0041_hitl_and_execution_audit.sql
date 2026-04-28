-- Migration 0041: HITL approvals + execution audit (move out of memory).
--
-- WHY: Pre-Round-26 these lived as module-level Maps. On Vercel each
-- request can hit a fresh isolate, so a user who submitted an action
-- for HITL approval, navigated away, and came back tomorrow would
-- find their request had VANISHED — not denied, not timed out, just
-- gone. Same for executionAudit: the /security page surfaced these
-- as "verified" when the buffer was actually amnesiac.
--
-- The audit (April 28 2026) flagged this as a critical reliability
-- gap with a procurement-grade truth-narrative implication. The
-- platform's whole story is "every action has an immutable trail";
-- having the HITL queue evaporate on cold-start broke that story.
--
-- SHAPE:
--
--   hitl_approvals      — pending + decided approvals (mutable on the
--                         decided_at field, immutable on everything
--                         else). Tenant-scoped via user_id.
--
--   execution_audit_log — append-only mirror of agent invocations
--                         with safety pipeline + chain-depth + APIs
--                         touched. Pairs with audit_logs (the SHA-256
--                         hash chain in 0033) for "what did this
--                         agent actually do?"
--
-- Both tables are tenant-scoped (RLS-ready). Append-only on the
-- audit table; mutable only on hitl_approvals.status / decided_*.
--
-- STORAGE: HITL approvals are bounded (10/user typical, ~24h TTL
-- via prune cron). Execution audit grows ~1KB/agent-call; expect
-- 100MB/month at moderate scale. Cheap. Partition later if needed.

CREATE TABLE IF NOT EXISTS hitl_approvals (
  id            TEXT         PRIMARY KEY,
  user_id       TEXT         NOT NULL,
  agent_name    TEXT         NOT NULL,
  action        TEXT         NOT NULL,
  description   TEXT         NOT NULL,
  metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- Status: pending | approved | denied | timeout. Mutable from
  -- pending → terminal. Once terminal, never changes (forensic).
  status        TEXT         NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMP    NOT NULL,
  decided_at    TIMESTAMP,
  decided_by    TEXT
);

-- Per-user pending lookup (the dashboard's "what's waiting?" query).
CREATE INDEX IF NOT EXISTS idx_hitl_approvals_user_status
  ON hitl_approvals (user_id, status, created_at DESC);

-- Sweep candidate index — the prune cron (every hour) scans for
-- pending rows past expires_at and flips them to 'timeout'.
CREATE INDEX IF NOT EXISTS idx_hitl_approvals_pending_expired
  ON hitl_approvals (status, expires_at)
  WHERE status = 'pending';


CREATE TABLE IF NOT EXISTS execution_audit_log (
  id                       TEXT         PRIMARY KEY,
  tenant_id                TEXT         NOT NULL,
  agent_name               TEXT         NOT NULL,
  model_used               TEXT         NOT NULL,
  -- Inputs/outputs are pre-truncated to 500 chars at the lib layer
  -- so a chatty agent can't bloat the row. The full payload lives
  -- in the runs table (playbook_dag_runs.results) when applicable.
  input_truncated          TEXT         NOT NULL,
  output_truncated         TEXT         NOT NULL,
  safety_jailbreak         TEXT         NOT NULL,
  safety_pii               TEXT         NOT NULL,
  safety_content           TEXT         NOT NULL,
  safety_quality           INTEGER      NOT NULL,
  safety_critic            TEXT         NOT NULL,
  trust_level              INTEGER      NOT NULL,
  approval_required        BOOLEAN      NOT NULL DEFAULT FALSE,
  approval_status          TEXT         NOT NULL,
  execution_time_ms        INTEGER      NOT NULL,
  chain_depth              INTEGER      NOT NULL DEFAULT 0,
  external_apis_accessed   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  data_exported            BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Tenant-scoped recency lookup (powers the security command center).
CREATE INDEX IF NOT EXISTS idx_execution_audit_tenant_created
  ON execution_audit_log (tenant_id, created_at DESC);

-- Anomaly investigation index — finding all blocked actions in the
-- last hour without scanning the whole tenant slice.
CREATE INDEX IF NOT EXISTS idx_execution_audit_blocks
  ON execution_audit_log (tenant_id, safety_jailbreak, created_at DESC)
  WHERE safety_jailbreak = 'fail';


-- Round 26 — usage outbox. Captures usage-counter increments that
-- failed to land in `usage` (DB flake, lock contention, etc) so a
-- cron drainer can replay them. Pre-R26 the increment was a single
-- INSERT swallowed by a try/catch that logged but didn't recover —
-- a transient DB hiccup silently lost the user's run from their
-- monthly counter, which means free-tier customers got more runs
-- than they paid for.
--
-- Shape: every failed increment becomes a pending row here. The
-- drainer runs every 1 min via Vercel Cron, reads pending rows in
-- batches, attempts the canonical insert, and marks them processed.
-- Replays are idempotent because the canonical `usage` row carries
-- the same outbox_id; a unique index prevents double-counting.

CREATE TABLE IF NOT EXISTS usage_outbox (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT         NOT NULL,
  agent_id     TEXT         NOT NULL,
  -- 'pending' (waiting for drainer), 'processed' (drainer landed
  -- the canonical row), 'failed' (drainer gave up after N retries).
  status       TEXT         NOT NULL DEFAULT 'pending',
  attempts     INTEGER      NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Drainer query — pending rows oldest-first. Bounded so the drainer
-- doesn't process the whole table in one tick.
CREATE INDEX IF NOT EXISTS idx_usage_outbox_pending
  ON usage_outbox (status, created_at)
  WHERE status = 'pending';

-- Per-user lookup (admin support: "did this user lose any usage
-- writes?"). Cheap because most users have 0 outbox rows.
CREATE INDEX IF NOT EXISTS idx_usage_outbox_user
  ON usage_outbox (user_id, created_at DESC);
