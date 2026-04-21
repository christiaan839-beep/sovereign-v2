-- ═══════════════════════════════════════════════════════════════════
-- 0022: Scheduled Playbooks — cron-expression-driven recurring runs
-- ═══════════════════════════════════════════════════════════════════
--
-- Lets users schedule any playbook to run on a cron expression so
-- "every Monday at 9am Eastern" is a real feature. A dispatcher cron
-- (/api/cron/dispatch-scheduled-playbooks) runs every minute, selects
-- rows where next_run_at <= now(), enqueues via the existing QStash
-- queue, and recomputes next_run_at.
--
-- Safety:
--   - failure_count auto-deactivates a schedule after 5 consecutive
--     failures so a broken playbook doesn't burn credits indefinitely
--   - RLS ensures one user cannot see or modify another user's schedules
--   - active flag provides manual pause without deletion
--
-- See: src/lib/scheduled-playbooks.ts for the service layer.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_playbooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  playbook_id      TEXT NOT NULL,
  inputs           TEXT NOT NULL DEFAULT '{}',
  cron_expression  TEXT NOT NULL,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at      TIMESTAMP NOT NULL,
  last_run_at      TIMESTAMP,
  last_run_id      UUID,
  run_count        INTEGER NOT NULL DEFAULT 0,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  name             TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_playbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled_playbooks(next_run_at) WHERE active = TRUE;

ALTER TABLE scheduled_playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_select_own ON scheduled_playbooks;
CREATE POLICY scheduled_select_own ON scheduled_playbooks
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_playbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scheduled_playbooks_updated_at ON scheduled_playbooks;
CREATE TRIGGER trigger_scheduled_playbooks_updated_at
  BEFORE UPDATE ON scheduled_playbooks
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_playbooks_updated_at();
