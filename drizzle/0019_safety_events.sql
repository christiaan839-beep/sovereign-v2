-- ═══════════════════════════════════════════════════════════════════
-- 0019: Safety Events — audit log for blocked content
-- ═══════════════════════════════════════════════════════════════════
--
-- Every time NemoGuard (jailbreak, content-safety, PII, or output-safety)
-- blocks content, we persist a row here. This is the audit trail for:
--   - SOC 2 evidence that the safety pipeline actually runs
--   - Pattern analysis ("which prompt patterns get flagged?")
--   - Customer disputes ("why was my request blocked?")
--
-- Privacy: we store SHA-256 hashes of prompts, NOT the prompts themselves.
-- Sovereignty mandate — the platform must never hold raw prompts that were
-- flagged as unsafe (by definition, they may contain PII, secrets, etc).
--
-- Retention: 90 days via scheduled cleanup job. Long enough for pattern
-- analysis + audit, short enough to limit exposure.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS safety_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,                       -- NULL for anonymous/public endpoints
  agent_id      TEXT NOT NULL,
  stage         TEXT NOT NULL,               -- 'jailbreak' | 'content_in' | 'content_out' | 'pii' | 'topic'
  reason        TEXT NOT NULL,
  category      TEXT,                        -- NemoGuard category when available
  prompt_hash   TEXT NOT NULL,               -- SHA-256, 64 hex chars
  prompt_len    INTEGER NOT NULL,            -- original length (for pattern analysis)
  outcome       TEXT NOT NULL,               -- 'blocked' | 'warned' | 'skipped'
  metadata      JSONB DEFAULT '{}'::JSONB,
  created_at    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT safety_events_stage_known CHECK (
    stage IN ('jailbreak', 'content_in', 'content_out', 'pii', 'topic', 'quality')
  ),
  CONSTRAINT safety_events_outcome_known CHECK (
    outcome IN ('blocked', 'warned', 'skipped', 'passed')
  )
);

CREATE INDEX IF NOT EXISTS idx_safety_events_user_created ON safety_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_agent ON safety_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_stage ON safety_events(stage);
CREATE INDEX IF NOT EXISTS idx_safety_events_created ON safety_events(created_at);

-- RLS: only users see their own safety events. Admins bypass via service-role.
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_events_select_own ON safety_events;
CREATE POLICY safety_events_select_own ON safety_events
  FOR SELECT USING (user_id = current_setting('app.current_user', true));
