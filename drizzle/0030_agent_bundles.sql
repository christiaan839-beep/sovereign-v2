-- Migration 0030: agent bundles — curated sets of agents published as
-- a single purchasable unit.
--
-- Why bundles matter: a customer who wants to automate "real estate
-- listing operations" needs ~6 agents (valuation, description, MLS,
-- comps, staging, outreach). Paying per-agent is friction. Bundles
-- let creators (or the platform) package agents into workflow
-- solutions. This is the revenue surface that makes SAM v1.0
-- dependencies commercially meaningful.
--
-- Pricing:
--   * price_cents  — what buyers pay per bundle invocation
--   * creator_share_pct — what % of price flows to the bundle publisher
--                          (default 70). Sub-creator shares are
--                          distributed via bundle_memberships.share_pct.
--
-- Membership:
--   * bundle_memberships.share_pct is 0..100 per member; sum across
--     a bundle's members must equal 100 at query time (enforced in
--     the agent-bundles.ts library at write time).

CREATE TABLE IF NOT EXISTS agent_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  -- Who publishes the bundle; may be the platform ("sovereignmatrix")
  -- or any creator email. Bundles of bundles are NOT supported in v1.
  publisher_email TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  creator_share_pct INTEGER NOT NULL DEFAULT 70 CHECK (creator_share_pct BETWEEN 0 AND 100),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundles_public ON agent_bundles (is_public, category) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_bundles_publisher ON agent_bundles (publisher_email);

CREATE TABLE IF NOT EXISTS agent_bundle_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES agent_bundles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
  -- The slug of the agent AT TIME OF BUNDLING — snapshot so renames
  -- don't silently break bundles. Resolved via the marketplace_agents
  -- row at query time for the live URL.
  agent_slug TEXT NOT NULL,
  share_pct INTEGER NOT NULL CHECK (share_pct BETWEEN 0 AND 100),
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bundle_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_memberships_bundle ON agent_bundle_memberships (bundle_id, position);
CREATE INDEX IF NOT EXISTS idx_bundle_memberships_agent ON agent_bundle_memberships (agent_id);
