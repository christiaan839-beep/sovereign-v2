-- Migration 0035: visual-editor playbook DAG storage.
--
-- WHY: Phase 2 (commit aaba1fa6) shipped the drag-drop authoring
-- canvas + a /api/playbooks/dag endpoint that validated DAGs but
-- didn't persist them. Phase 3 (this migration + companion code
-- changes) adds the storage column.
--
-- SHAPE: Add `dag` JSONB column on `playbooks`. Existing code-defined
-- playbooks have `dag = NULL` and continue to execute via their
-- registry-based path. New DAG-shaped playbooks have a JSONB
-- payload of shape:
--
--   {
--     "nodes": [{ "id": ..., "agent": ..., "position": {...},
--                 "config": {...} }, ...],
--     "edges": [{ "from": "<nodeId>.<field>", "to": "<nodeId>.<field>" }, ...]
--   }
--
-- BACKWARD-COMPAT: existing playbooks unaffected (column is NULL).
-- New playbooks can be either code-defined OR DAG-shaped — the
-- runner picks the right execution path based on which column is
-- populated.

ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS dag JSONB;

-- Index supports the visual editor's "list my DAG playbooks" query
-- so we don't full-scan looking for non-NULL dag rows.
CREATE INDEX IF NOT EXISTS playbooks_dag_idx ON playbooks ((dag IS NOT NULL));
