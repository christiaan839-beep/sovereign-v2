-- Migration 0033: tamper-detectable hash chain on audit_logs.
--
-- WHY: Standard append-only audit logs stop an attacker from deleting a
-- row, but don't stop them from EDITING a row in-place to hide an action.
-- A hash chain — each row's hash includes the previous row's hash — means
-- any edit breaks the chain, and /api/admin/audit/verify-chain can detect
-- the break by position.
--
-- SHAPE:
--   prev_hash — sha256 hex of the previous audit_log row's row_hash.
--   row_hash  — sha256 hex of (prev_hash || userId || action || resource
--                              || details || createdAt). Computed in
--                src/lib/audit-log.ts at insert time.
--
-- OLD ROWS: remain with NULL hashes. The verifier skips pre-chain rows
-- and anchors the chain at the first row that carries a hash. This keeps
-- the migration non-breaking for existing fleets.
--
-- PERF: one extra string per row + an index on (id, prev_hash) so the
-- verifier can walk forward without sequential scans.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS row_hash TEXT;

-- Index supports the verify-chain walk: ordered scan by id,
-- quickly join to next row's prev_hash.
CREATE INDEX IF NOT EXISTS audit_logs_row_hash_idx ON audit_logs (row_hash);
CREATE INDEX IF NOT EXISTS audit_logs_prev_hash_idx ON audit_logs (prev_hash);
