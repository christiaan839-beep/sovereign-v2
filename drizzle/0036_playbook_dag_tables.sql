-- Migration 0036: visual-editor DAG storage — proper tables.
--
-- WHY: 0035 was a placeholder ALTER TABLE on a `playbooks` table that
-- didn't actually exist in the Drizzle schema. The /api/playbooks/dag
-- route fell through to "validate-only" mode silently in production
-- because the column add was a no-op. This migration creates the
-- proper storage architecture.
--
-- TWO TABLES:
--
--   playbook_dags       — visual-editor playbook definitions
--   playbook_dag_runs   — execution history with snapshot + results
--
-- SEPARATION RATIONALE:
--   1. Authoring (the dag definition) and execution (a specific run)
--      are different concerns. One DAG can have many runs.
--   2. dag_snapshot in runs lets us preserve historical accuracy when
--      the user edits the DAG between runs — the run history shows
--      what ACTUALLY ran, not what the DAG looks like today.
--   3. dag_id is a SET NULL FK so deleting a DAG keeps its run history
--      (with the snapshot) intact for forensics + analytics.
--
-- BACKWARD-COMPAT: drizzle/0035 still applies (its ALTER IF NOT EXISTS
-- is a graceful no-op when the `playbooks` table doesn't exist). The
-- live route migrates to these tables; old data, if any, would need a
-- one-shot copy script (none expected — we never had a working save).

CREATE TABLE IF NOT EXISTS playbook_dags (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT         NOT NULL,
  name          TEXT         NOT NULL,
  description   TEXT,
  -- The full DAG payload. Shape matches PlaybookDag in
  -- src/lib/playbook-dag.ts: { nodes: [...], edges: [...] }
  dag           JSONB        NOT NULL,
  status        TEXT         NOT NULL DEFAULT 'draft',  -- draft | published | archived
  -- Denormalized counts so the list endpoint can show "12 nodes, 8
  -- edges" without parsing JSONB on every row. Cheap on write,
  -- millisecond-saver on reads.
  node_count    INTEGER      NOT NULL DEFAULT 0,
  edge_count    INTEGER      NOT NULL DEFAULT 0,
  -- Last-run telemetry. NULL until first execution. Kept on the DAG
  -- row for the "My playbooks" panel which renders status pills.
  last_run_at        TIMESTAMP,
  last_run_status    TEXT,           -- completed | failed | NULL
  last_run_duration_ms INTEGER,
  created_at    TIMESTAMP    DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMP    DEFAULT NOW() NOT NULL
);

-- The list-my-dags query in the editor. Covers `WHERE user_id = $1
-- ORDER BY updated_at DESC LIMIT N`.
CREATE INDEX IF NOT EXISTS idx_playbook_dags_user_updated
  ON playbook_dags (user_id, updated_at DESC);

-- Status filter for archived/draft separation in admin views.
CREATE INDEX IF NOT EXISTS idx_playbook_dags_user_status
  ON playbook_dags (user_id, status);


CREATE TABLE IF NOT EXISTS playbook_dag_runs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  -- FK to the source DAG. SET NULL on delete so run history survives
  -- the parent DAG's deletion (the dag_snapshot column captures the
  -- shape that ran).
  dag_id          UUID         REFERENCES playbook_dags(id) ON DELETE SET NULL,
  -- Frozen snapshot of the DAG at execution time. Critical for
  -- forensics: "what did this run actually execute?" cannot be
  -- answered by reading the live DAG row, which may have been edited
  -- since.
  dag_snapshot    JSONB        NOT NULL,
  status          TEXT         NOT NULL,           -- completed | failed
  node_count      INTEGER      NOT NULL,
  edge_count      INTEGER      NOT NULL,
  -- Per-node results array (NodeRunResult[] in playbook-dag.ts).
  -- Stored as JSONB for the run-detail page. Truncated upstream if a
  -- single node's output is huge — see store implementation.
  results         JSONB        NOT NULL,
  total_duration_ms  INTEGER   NOT NULL,
  -- nodeId of the first failing node (matches ExecuteDagResult.failedAt).
  -- NULL when status='completed'.
  failed_at       TEXT,
  created_at      TIMESTAMP    DEFAULT NOW() NOT NULL
);

-- Recent-runs queries on the dashboard.
CREATE INDEX IF NOT EXISTS idx_playbook_dag_runs_user_created
  ON playbook_dag_runs (user_id, created_at DESC);

-- Per-DAG run history shown on the editor page.
CREATE INDEX IF NOT EXISTS idx_playbook_dag_runs_dag
  ON playbook_dag_runs (dag_id, created_at DESC);

-- Status filter for the "failed runs only" view.
CREATE INDEX IF NOT EXISTS idx_playbook_dag_runs_user_status
  ON playbook_dag_runs (user_id, status);
