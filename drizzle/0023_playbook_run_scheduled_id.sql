-- ═══════════════════════════════════════════════════════════════════
-- 0023: Link playbook_runs back to their scheduled_playbooks row
-- ═══════════════════════════════════════════════════════════════════
--
-- When the dispatcher cron fires a scheduled playbook, we want the
-- resulting run row to carry a reference to the schedule that
-- triggered it. This lets the dashboard render "this run was fired
-- by schedule 'Weekly SEO audit'" and the schedule detail view list
-- past runs.
--
-- Additive only — existing rows get NULL (manual/user-triggered runs).
-- No ON DELETE CASCADE: if a schedule is deleted, the historical runs
-- it created remain (their scheduled_id becomes dangling, but the run
-- data is user-visible history we should preserve).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE playbook_runs
  ADD COLUMN IF NOT EXISTS scheduled_id UUID;

CREATE INDEX IF NOT EXISTS idx_playbook_runs_scheduled
  ON playbook_runs(scheduled_id)
  WHERE scheduled_id IS NOT NULL;
