-- Migration 0037: async/queued DAG execution.
--
-- WHY: Round 10's playbook_dag_runs.status was 'completed' | 'failed'
-- only — the table assumed every row was for a finished run. The
-- async path (Round 12) needs an in-flight state so the user can
-- watch the run progress AND the cleanup job can spot orphaned
-- background workers.
--
-- COLUMNS:
--   status now also accepts 'running' (no constraint change at the
--   SQL level — the column is TEXT, not an enum, so no migration is
--   needed to widen it; the typescript type is the only constraint).
--   This comment serves as documentation for that intent.
--
--   progress_nodes_completed — incrementally updated as each node
--     finishes. Lets the editor's polling client render a partial
--     "5 of 12 nodes complete" state without re-parsing the results
--     JSONB.
--
--   started_at — distinct from created_at because async runs have a
--     queue delay between INSERT (created_at) and worker pickup
--     (started_at). For sync runs they're effectively equal.
--
--   last_progress_at — updated on every node-complete write. The
--     orphan-detection cleanup (future) uses this to mark
--     "running" rows older than ~10 minutes as failed.
--
-- BACKWARD-COMPAT: all new columns are nullable. Existing rows get
-- NULL for new fields; the SavedDagRun type narrows them safely.

ALTER TABLE playbook_dag_runs
  ADD COLUMN IF NOT EXISTS progress_nodes_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMP;

-- Lookup index for the orphan-detection cleanup job: find rows where
-- status='running' and last_progress_at is older than the threshold.
CREATE INDEX IF NOT EXISTS idx_playbook_dag_runs_running_orphans
  ON playbook_dag_runs (status, last_progress_at)
  WHERE status = 'running';
