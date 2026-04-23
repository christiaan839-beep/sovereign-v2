-- Migration 0027: marketplace_agent_views — view-tracking for the
-- /marketplace/[slug] detail pages.
--
-- Privacy posture: no IP, no raw user-agent, no referrer beyond host.
-- Identity is an anonymous UUID minted client-side + stored in
-- localStorage; the server only sees that UUID. A 60-second dedupe
-- prevents refresh-spam from inflating view counts.
--
-- Storage: rows are ~100 bytes each. A week of 10k views = ~1MB.
-- Cheap enough that we don't bother auto-deleting; weekly rollups
-- into the marketplace_agents.weekly_run_count column give fast
-- access to the common "top agents" query.

CREATE TABLE IF NOT EXISTS marketplace_agent_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
  slug TEXT,                                   -- denormalised for fast filter
  anonymous_id TEXT NOT NULL,                  -- client-minted UUID
  referrer_host TEXT,                          -- e.g. "google.com" — no path
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query patterns the UI needs:
--  - "how many views in the last 7 days for agent X" → (agent_id, created_at)
--  - "top N viewed agents this week"                 → (created_at, agent_id)
--  - dedupe within 60s: (anonymous_id, agent_id, created_at)
CREATE INDEX IF NOT EXISTS idx_views_agent_time
  ON marketplace_agent_views (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_views_time
  ON marketplace_agent_views (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_views_anon_agent
  ON marketplace_agent_views (anonymous_id, agent_id, created_at DESC);
