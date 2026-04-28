-- Migration 0040: DAG version history.
--
-- WHY: Every save of a visual-editor playbook today overwrites the
-- prior shape. There's no "I broke something — restore yesterday's
-- version" flow. Procurement teams reviewing the platform during
-- diligence ask about audit trail completeness — "what did this DAG
-- look like 3 weeks ago?" should be answerable, not just "what does
-- it look like now?"
--
-- SHAPE:
--
--   playbook_dag_versions ─ append-only history. Every save creates
--   a new row; there's no UPDATE on this table outside admin tooling.
--   The current playbook_dags row is the "live" version (latest);
--   this table is the immutable trail.
--
-- MAINTAINS THE FORENSIC PROPERTY:
--
--   Round 10 introduced playbook_dag_runs.dagSnapshot — the frozen
--   shape that ACTUALLY EXECUTED. This new table tracks the shape
--   that was SAVED at each edit. Combined, they answer:
--
--     - "what did this run actually execute?" (run.dagSnapshot)
--     - "what did the saved DAG look like at time T?" (versions
--        table — version_at[T])
--     - "did the user edit between this run and the next?" (compare
--        the two)
--
-- STORAGE: append-only on save. ~1 KB/version × 100 saves/playbook
-- × N playbooks. Cheap. If a customer ever has 10K versions of a
-- single playbook (suspicious churn), we pause and investigate
-- rather than auto-prune — the trail is the audit story.

CREATE TABLE IF NOT EXISTS playbook_dag_versions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id        UUID         NOT NULL REFERENCES playbook_dags(id) ON DELETE CASCADE,
  user_id       TEXT         NOT NULL,
  -- Monotonic per-DAG counter. version=1 is the first save; the
  -- current playbook_dags row's version_count column matches the
  -- latest version number after every successful save.
  version       INTEGER      NOT NULL,
  -- The DAG payload at this version. Same shape as
  -- playbook_dags.dag (PlaybookDag from src/lib/playbook-dag.ts).
  dag           JSONB        NOT NULL,
  -- Optional human-readable note ("Added n3 for follow-ups",
  -- "Reverted to v3"). Stored for the restoration UI.
  note          TEXT,
  -- Set when this version was created via a restore operation,
  -- pointing at the version that was restored. Lets the UI render
  -- "v8 (restored from v3)" in the timeline.
  restored_from_version INTEGER,
  created_at    TIMESTAMP    DEFAULT NOW() NOT NULL
);

-- Per-DAG version listing (newest-first). Powers the "Version
-- history" sidebar in the editor.
CREATE INDEX IF NOT EXISTS idx_playbook_dag_versions_dag_created
  ON playbook_dag_versions (dag_id, version DESC);

-- Tenant-scoped lookup for "all versions across all my DAGs"
-- (future admin / audit surface).
CREATE INDEX IF NOT EXISTS idx_playbook_dag_versions_user_created
  ON playbook_dag_versions (user_id, created_at DESC);

-- Add version_count to the parent table so the editor can show
-- "v12 of 12" without a COUNT(*) on every load.
ALTER TABLE playbook_dags
  ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0;
