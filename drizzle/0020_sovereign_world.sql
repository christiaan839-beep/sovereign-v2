-- ═══════════════════════════════════════════════════════════════════
-- 0020: Sovereign World — marketplace, reviews, installs, stats
-- ═══════════════════════════════════════════════════════════════════
--
-- Four tables powering /world, /marketplace, /agents/[slug], and
-- /leaderboard. The registry in src/app/api/agents/registry.ts is
-- the source of truth for *which* agents exist; these tables carry
-- the metadata + user interactions that the registry doesn't model.
--
--   agent_metadata     — display name, category, pricing, featured flag
--   agent_installs     — which users pinned which agents
--   agent_reviews      — 1..5 rating + comment, one per (user, agent)
--   agent_stats_daily  — nightly rollup from agent_activity for fast reads
--
-- Slug (text) is the primary key for agent_metadata. Every other table
-- uses slug as the foreign key — the DB becomes self-documenting and
-- joins don't need a lookup. Rename-as-migration is the trade-off.
-- ═══════════════════════════════════════════════════════════════════

-- ─── agent_metadata ──────────────────────────────────────────────
-- Display + pricing data per agent. Slug MUST match registry key.
-- Rows in this table override code-derived defaults at read time.
CREATE TABLE IF NOT EXISTS agent_metadata (
  slug              TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  tagline           TEXT,
  description       TEXT,
  category          TEXT NOT NULL DEFAULT 'general',
  subcategory       TEXT,
  icon              TEXT,          -- emoji OR lucide name ("Target", "Search")
  hero_color        TEXT,          -- hex or tailwind token, for card accent
  creator_user_id   TEXT,          -- NULL = built-in (platform); else marketplace submission
  creator_handle    TEXT,          -- public display name — denormalized for list perf
  pricing_cents     INTEGER NOT NULL DEFAULT 0,
  tags              TEXT[],
  featured          BOOLEAN NOT NULL DEFAULT FALSE,
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  published         BOOLEAN NOT NULL DEFAULT TRUE,
  visibility        TEXT NOT NULL DEFAULT 'public', -- public | unlisted | private
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT agent_metadata_visibility_known CHECK (visibility IN ('public','unlisted','private')),
  CONSTRAINT agent_metadata_pricing_non_negative CHECK (pricing_cents >= 0)
);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_category ON agent_metadata(category);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_creator ON agent_metadata(creator_user_id) WHERE creator_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_metadata_featured ON agent_metadata(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_metadata_visibility ON agent_metadata(visibility);

-- ─── agent_installs ──────────────────────────────────────────────
-- "Pin" relation: user keeps a list of their go-to agents for quick
-- access. Unique constraint prevents double-pinning.
CREATE TABLE IF NOT EXISTS agent_installs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  agent_slug     TEXT NOT NULL,
  installed_at   TIMESTAMP DEFAULT NOW(),
  CONSTRAINT agent_installs_unique UNIQUE (user_id, agent_slug)
);
CREATE INDEX IF NOT EXISTS idx_agent_installs_user ON agent_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_installs_agent ON agent_installs(agent_slug);

-- ─── agent_reviews ──────────────────────────────────────────────
-- Rating 1..5 enforced at the CHECK level. One review per user per
-- agent — upsert semantics, so "leaving a second review" is actually
-- an update.
CREATE TABLE IF NOT EXISTS agent_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  agent_slug  TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT agent_reviews_one_per_user UNIQUE (user_id, agent_slug)
);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_agent ON agent_reviews(agent_slug, created_at DESC);

-- ─── agent_stats_daily ──────────────────────────────────────────
-- Denormalized daily rollup from agent_activity. Nightly cron
-- /api/cron/rollup-agent-stats upserts here so read-side queries
-- (/world, /leaderboard) stay O(1) no matter how many runs exist.
CREATE TABLE IF NOT EXISTS agent_stats_daily (
  agent_slug          TEXT NOT NULL,
  day                 DATE NOT NULL,
  runs                INTEGER NOT NULL DEFAULT 0,
  successes           INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms     INTEGER,
  total_cost_cents    INTEGER NOT NULL DEFAULT 0,
  unique_users        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_slug, day)
);
CREATE INDEX IF NOT EXISTS idx_agent_stats_day ON agent_stats_daily(day DESC);

-- ─── Row Level Security ─────────────────────────────────────────
-- Public read for agent_metadata (unless visibility='private'),
-- own-user-only for installs. Reviews are globally readable but
-- you can only write your own.
ALTER TABLE agent_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_metadata_select_public ON agent_metadata;
CREATE POLICY agent_metadata_select_public ON agent_metadata
  FOR SELECT USING (
    visibility = 'public' OR
    visibility = 'unlisted' OR
    creator_user_id = current_setting('app.current_user', true)
  );

DROP POLICY IF EXISTS agent_installs_select_own ON agent_installs;
CREATE POLICY agent_installs_select_own ON agent_installs
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

DROP POLICY IF EXISTS agent_reviews_select_public ON agent_reviews;
CREATE POLICY agent_reviews_select_public ON agent_reviews FOR SELECT USING (true);

-- ─── updated_at trigger for agent_metadata + reviews ────────────
CREATE OR REPLACE FUNCTION sovereign_world_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_metadata_updated_at ON agent_metadata;
CREATE TRIGGER trigger_agent_metadata_updated_at
  BEFORE UPDATE ON agent_metadata
  FOR EACH ROW EXECUTE FUNCTION sovereign_world_updated_at();

DROP TRIGGER IF EXISTS trigger_agent_reviews_updated_at ON agent_reviews;
CREATE TRIGGER trigger_agent_reviews_updated_at
  BEFORE UPDATE ON agent_reviews
  FOR EACH ROW EXECUTE FUNCTION sovereign_world_updated_at();
