-- ============================================================================
-- 0020_packets.sql
-- ============================================================================
-- Persistence for the four vertical-packet runs (agency-content-packet,
-- recruiting-sourcing-sprint, growth-pulse, listing-pulse).
--
-- Each row is a single user-visible artifact:
--   - inputJson  : form values the user submitted
--   - outputJson : the full structured packet response (verbatim, so
--                  re-opening the packet doesn't re-charge the LLM)
--   - errorCount : how many sub-assets failed (Promise.allSettled)
--   - durationMs : server-measured run time
--
-- Indexed by user_id (most common access pattern: list a user's packets),
-- by kind (admin / analytics view), and by created_at (recency ordering).
-- ============================================================================

CREATE TABLE IF NOT EXISTS packets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  input_json   TEXT NOT NULL DEFAULT '{}',
  output_json  TEXT NOT NULL DEFAULT '{}',
  error_count  INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packets_user    ON packets (user_id);
CREATE INDEX IF NOT EXISTS idx_packets_kind    ON packets (kind);
CREATE INDEX IF NOT EXISTS idx_packets_created ON packets (created_at);

-- ROLLBACK
-- DROP TABLE IF EXISTS packets;
