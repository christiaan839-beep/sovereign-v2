-- Migration 0050: Trust-as-Collateral — Agent Credit Lines.
--
-- Round 42 — composes R26 (audit) + R30 (cost-runaway) + R40
-- (reputation) into a self-regulating economic loop. Reputation
-- modulates the spend cap. A grade-A+ agent gets 5x the default
-- daily limit; a grade-F agent gets 0.25x.
--
-- See docs/adr/0008-trust-as-collateral.md for the multiplier table
-- and the staging plan (R42 publishes the credit line as a signal,
-- R43 wires it into cost-runaway.ts).
--
-- One row per agent, recomputed daily by the rollup-agent-credit
-- cron. The credit line composes against the *current* reputation
-- score, so it tracks reputation changes day over day.

CREATE TABLE IF NOT EXISTS agent_credit_lines (
  -- Primary key on agent_id (matches agent_reputation_scores).
  agent_id                     TEXT          PRIMARY KEY,
  -- Snapshotted from agent_reputation_scores at compute time.
  letter_grade                 TEXT          NOT NULL,
  -- Snapshotted numeric score 0-100.
  numeric_score                INTEGER       NOT NULL,
  -- The multiplier applied to the base daily limit.
  -- 0.25 (grade F) → 5.00 (grade A+).
  multiplier                   NUMERIC(4,2)  NOT NULL,
  -- The tenant plan's base daily limit (in cents) at compute time.
  -- Snapshotted so the credit line is reproducible even if plan
  -- pricing changes later.
  base_daily_limit_cents       INTEGER       NOT NULL,
  -- base * multiplier, rounded. This is the number the future
  -- R43-wired cost-runaway.ts will read.
  effective_daily_limit_cents  INTEGER       NOT NULL,
  -- When the daily cron computed this credit line.
  computed_at                  TIMESTAMP     NOT NULL DEFAULT NOW(),
  -- Defense-in-depth: keep multipliers within the documented table.
  -- App-side validator is the primary defense; this is a safety net
  -- against a buggy cron writing nonsense values directly.
  CONSTRAINT multiplier_in_range
    CHECK (multiplier >= 0.10 AND multiplier <= 10.00),
  -- Defense-in-depth: limits never go negative.
  CONSTRAINT effective_limit_nonneg
    CHECK (effective_daily_limit_cents >= 0),
  -- Defense-in-depth: numeric_score in valid range (mirrors
  -- agent_reputation_scores).
  CONSTRAINT numeric_score_in_range
    CHECK (numeric_score >= 0 AND numeric_score <= 100),
  -- Mirror the grade enum from R40.
  CONSTRAINT grade_valid
    CHECK (letter_grade IN ('A+','A','A-','B+','B','B-','C+','C','C-','D','F','no_score_yet'))
);

-- Find highest-credit-line agents (procurement filter:
-- "agents with effective limits >= $200/day").
CREATE INDEX IF NOT EXISTS idx_credit_effective_limit_desc
  ON agent_credit_lines (effective_daily_limit_cents DESC, computed_at DESC);

-- Find recently-computed credit lines (admin dashboard).
CREATE INDEX IF NOT EXISTS idx_credit_computed_at
  ON agent_credit_lines (computed_at DESC);

-- Find agents by grade (procurement filter: "A-grade or better only").
CREATE INDEX IF NOT EXISTS idx_credit_letter_grade
  ON agent_credit_lines (letter_grade);
