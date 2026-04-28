-- Migration 0042: Self-healing telemetry + cost runaway guard.
--
-- WHY: Round 27 — The Permanence Sprint. Two layers of self-defense
-- against the project's two highest-blast-radius failure modes:
--
--   1. ARCHITECTURAL DRIFT — silent regressions accumulate over
--      months. The anti-drift gate runs in CI on every PR, but a
--      direct push to main, a force-push, or a bypassed CI catches
--      nothing. The hourly self-healing cron persists every check
--      result so an operator can see "we've been at 141/141 for 90
--      days" and trust it.
--
--   2. FINANCIAL DEATH — a single misconfigured agent, an A2E loop
--      that recurses, an attacker holding a stolen API key. Without
--      a bounded ceiling, the platform's worst plausible failure
--      mode is bankruptcy. The runaway guard caps per-tenant 24h
--      spend at the configured ceiling; a tenant who hits it gets
--      auto-paused and the operator gets paged.
--
-- SHAPE:
--
--   platform_health_snapshots — append-only telemetry.
--   Every hour, the self-healing cron writes one row capturing the
--   full anti-drift result + tests-passing + key counters. The
--   admin dashboard graphs "invariants over time" which is the
--   single most important leading indicator of project decay.
--
--   tenant_cost_ledger — per-tenant per-day spend rollup.
--   Updated on every agent run via the agent-factory. The runaway
--   guard reads this in O(1) per request to enforce the daily cap.
--
-- STORAGE: ~24 health snapshots/day × 365 days × ~2KB = ~17MB/yr.
-- Cost ledger: 1 row/tenant/day; tiny.

CREATE TABLE IF NOT EXISTS platform_health_snapshots (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Total invariants checked at snapshot time. Increments as new
  -- gates ship; the trend "more invariants over time" is itself a
  -- health signal.
  invariants_total      INTEGER  NOT NULL,
  invariants_passing    INTEGER  NOT NULL,
  invariants_failing    INTEGER  NOT NULL,
  -- The names of the failing checks (for forensic detail). Empty
  -- array when all pass.
  failing_checks        JSONB    NOT NULL DEFAULT '[]'::jsonb,
  tests_passing         INTEGER,
  tests_total           INTEGER,
  -- Quick-glance "is the platform healthy?" — true iff every
  -- invariant passes AND the test suite passes.
  healthy               BOOLEAN  NOT NULL,
  duration_ms           INTEGER  NOT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Trend index — admin dashboard renders 30 days of snapshots; this
-- powers "invariants over time" without scanning the full table.
CREATE INDEX IF NOT EXISTS idx_platform_health_recent
  ON platform_health_snapshots (created_at DESC);

-- Anomaly index — finding all unhealthy snapshots in a window
-- (the "when did we first regress?" forensic query).
CREATE INDEX IF NOT EXISTS idx_platform_health_unhealthy
  ON platform_health_snapshots (healthy, created_at DESC)
  WHERE healthy = FALSE;


CREATE TABLE IF NOT EXISTS tenant_cost_ledger (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  -- Day bucket — UTC midnight. Multi-day accumulation joins on
  -- this column. Stored as DATE (not TIMESTAMP) so the unique
  -- constraint below is per-calendar-day cleanly.
  day             DATE         NOT NULL,
  -- Cumulative cost in cents for the (user, day) tuple. Updated
  -- atomically via INSERT … ON CONFLICT … DO UPDATE.
  cost_cents      INTEGER      NOT NULL DEFAULT 0,
  -- Cumulative agent-run count for the day. Used for "abnormal
  -- volume" detection independent of cost.
  run_count       INTEGER      NOT NULL DEFAULT 0,
  -- When the tenant last hit the daily cap and was paused. NULL
  -- if never paused. Set by the runaway guard. The platform
  -- un-pauses at the next UTC day rollover.
  paused_at       TIMESTAMP,
  pause_reason    TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Atomic upsert key — one row per (user_id, day). The runaway
-- guard's INSERT … ON CONFLICT … DO UPDATE depends on this.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_cost_user_day
  ON tenant_cost_ledger (user_id, day);

-- Find paused tenants quickly. Powers the admin "currently paused
-- — investigate" dashboard.
CREATE INDEX IF NOT EXISTS idx_tenant_cost_paused
  ON tenant_cost_ledger (paused_at DESC)
  WHERE paused_at IS NOT NULL;
