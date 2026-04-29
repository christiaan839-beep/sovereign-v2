-- Migration 0049: Public Agent Reputation Scores.
--
-- Round 40 — the network-effect substrate. Aggregates signals from
-- R26 (audit chain) + R30 (reversals) + R33 (HITL rejections) +
-- R38 (manifest age) into a single procurement-readable score.
--
-- See docs/adr/0007-public-agent-reputation.md for the formula.
--
-- The score is computed by a daily Vercel cron and persisted here.
-- The `signals_json` field carries the full breakdown so a verifier
-- can see WHY a score is what it is — no black-box scoring.

CREATE TABLE IF NOT EXISTS agent_reputation_scores (
  -- One row per agent_id. Primary key on agent_id (not auto-uuid)
  -- because we replace the row entirely on each daily rollup.
  agent_id              TEXT         PRIMARY KEY,
  -- Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D, F.
  letter_grade          TEXT         NOT NULL,
  -- Numeric score 0-100 (clamped). Default base is 75.
  numeric_score         INTEGER      NOT NULL,
  -- 30-day reversal rate as a percentage. Lower = better reputation.
  reversal_rate_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- 30-day HITL rejection rate. Lower = better.
  hitl_rejection_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Audit chain integrity check at scoring time.
  audit_integrity       BOOLEAN      NOT NULL DEFAULT true,
  -- How long has this agent's manifest been registered?
  manifest_age_days     INTEGER      NOT NULL DEFAULT 0,
  -- Usage volume in last 30 days.
  usage_count_30d       INTEGER      NOT NULL DEFAULT 0,
  -- Cost efficiency score (0-10).
  cost_efficiency_score INTEGER      NOT NULL DEFAULT 5,
  -- Number of anomaly events tied to this agent in last 30 days.
  anomaly_count_30d     INTEGER      NOT NULL DEFAULT 0,
  -- Full signal breakdown for transparency. Verifiers can recompute.
  signals_json          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  -- When the daily cron computed this score.
  computed_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT score_in_range CHECK (numeric_score >= 0 AND numeric_score <= 100),
  CONSTRAINT grade_valid CHECK (letter_grade IN ('A+','A','A-','B+','B','B-','C+','C','C-','D','F','no_score_yet'))
);

-- Find top-scoring agents quickly (for leaderboards).
CREATE INDEX IF NOT EXISTS idx_reputation_score_desc
  ON agent_reputation_scores (numeric_score DESC, computed_at DESC);

-- Find recently-computed scores (admin dashboard).
CREATE INDEX IF NOT EXISTS idx_reputation_computed_at
  ON agent_reputation_scores (computed_at DESC);
