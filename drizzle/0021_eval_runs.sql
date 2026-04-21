-- ═══════════════════════════════════════════════════════════════════
-- 0021: Continuous Evals — eval_runs + eval_run_results
-- ═══════════════════════════════════════════════════════════════════
--
-- Every 6 hours a cron hits /api/cron/run-evals which executes the
-- golden-set agent evals (src/lib/__tests__/agent-evals/golden-set.ts)
-- against live agent routes and persists results here.
--
-- eval_runs     — one row per eval-suite execution; rolled-up pass rate
-- eval_run_results — one row per individual eval (eval_slug, agent_slug)
--
-- Drift detection reads the most recent two `eval_runs` rows; if the
-- pass_rate drops >5pts the system fires a Sentry alert. The
-- `output_hash` on each result lets us ALSO detect silent drift —
-- where outputs change but assertions still pass (e.g. a model
-- upgrade that shifts style without breaking shape).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eval_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  trigger       TEXT NOT NULL, -- 'scheduled' | 'manual' | 'ci'
  total         INTEGER NOT NULL DEFAULT 0,
  passed        INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER,
  pass_rate     REAL,
  CONSTRAINT eval_runs_trigger_known CHECK (trigger IN ('scheduled', 'manual', 'ci'))
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_started ON eval_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS eval_run_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  eval_slug     TEXT NOT NULL,
  agent_slug    TEXT NOT NULL,
  status        TEXT NOT NULL,
  duration_ms   INTEGER,
  error_message TEXT,
  output_hash   TEXT, -- SHA-256 of canonical-JSON output; drift marker
  created_at    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT eval_run_results_status_known CHECK (status IN ('passed', 'failed', 'skipped'))
);
CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_run_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_agent ON eval_run_results(agent_slug);
CREATE INDEX IF NOT EXISTS idx_eval_results_status ON eval_run_results(status);
