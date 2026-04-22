-- Migration 0025: extend marketplace_agents to support SAM v1.0 submissions
-- from the /creators/apply on-ramp.
--
-- The marketplace already has a well-designed lifecycle
-- (pending → in_review → verified → rejected → suspended); we reuse it
-- rather than creating a parallel creator_submissions table. Rows
-- submitted via /api/creators/submit land here with
-- submission_source = 'sam-v1' and carry the full SAM manifest in
-- manifest_raw for audit + future re-verification.
--
-- All columns are nullable so existing rows (submitted before SAM v1.0
-- existed) remain valid. The unique index on reference_id is partial
-- (WHERE reference_id IS NOT NULL) so older rows without one don't
-- collide on NULL.

ALTER TABLE marketplace_agents
  ADD COLUMN IF NOT EXISTS sam_version TEXT,
  ADD COLUMN IF NOT EXISTS manifest_raw JSONB,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS submission_policy TEXT,
  ADD COLUMN IF NOT EXISTS submission_reason TEXT,
  ADD COLUMN IF NOT EXISTS submission_source TEXT DEFAULT 'dashboard';

-- Fast lookup by the user-facing reference ID (SAM-xxxxxxxx-xxxx).
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_reference_id
  ON marketplace_agents (reference_id)
  WHERE reference_id IS NOT NULL;

-- Fast filter for operator review UI — "show me all SAM-v1 pending".
CREATE INDEX IF NOT EXISTS idx_marketplace_sam_pending
  ON marketplace_agents (submission_source, verification_status)
  WHERE submission_source = 'sam-v1';

-- Fast COUNT(*) for trust-tiered policy: "how many approved agents
-- does this author have?" Executed on every /creators/apply submission.
CREATE INDEX IF NOT EXISTS idx_marketplace_author_status
  ON marketplace_agents (author_email, verification_status);
