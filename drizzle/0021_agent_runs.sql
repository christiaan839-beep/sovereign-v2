-- ============================================================================
-- 0021_agent_runs.sql
-- ============================================================================
-- Persistent, signed receipts for every agent execution.
--
-- Powers the public verifiable receipt URL (/r/[id]) — the differentiator
-- that lets users prove what an agent did, with which models, against
-- which safety checks. Every row is HMAC-SHA256 signed at insert time
-- using AGENT_RUN_SIGNING_SECRET so tampering is detectable.
--
-- Visibility rules:
--   private  → only the owning user can fetch (default)
--   public   → anyone with the URL can fetch + can be indexed
--   unlisted → anyone with the URL can fetch (search-engine deindex)
--
-- Indexed by user (list mine), by agent_name (analytics), by created_at
-- (recency), and by visibility (filter public feed).
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,                                          -- nullable for anonymous demos
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  agent_name      TEXT NOT NULL,
  model_used      TEXT NOT NULL DEFAULT 'unknown',
  input_json      TEXT NOT NULL DEFAULT '{}',
  output_json     TEXT NOT NULL DEFAULT '{}',
  safety_result   TEXT NOT NULL DEFAULT '{}',                    -- serialized verifyOutput
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  chain_depth     INTEGER NOT NULL DEFAULT 0,
  trust_decision  TEXT NOT NULL DEFAULT 'auto-approved',
  visibility      TEXT NOT NULL DEFAULT 'private',
  signature       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user       ON agent_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent      ON agent_runs (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created    ON agent_runs (created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_visibility ON agent_runs (visibility);

-- ROLLBACK
-- DROP TABLE IF EXISTS agent_runs;
