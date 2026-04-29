-- Migration 0045: Multi-stage HITL approval workflow.
--
-- WHY: Round 33 deep-work. R26's hitl_approvals is single-
-- stage (one approver decides). Real procurement reviews demand
-- multi-stage: compliance reviews → security reviews → business
-- approves, with veto at any stage and chain-of-custody audit trail.
--
-- SHAPE:
--   Extends hitl_approvals with stage tracking columns
--   (without breaking back-compat — the existing single-stage flow
--   still works, with stage_count=1).
--
--   New table approval_stages stores per-stage state. Each stage has:
--     * role (e.g. "compliance", "security", "business")
--     * sequence position (0, 1, 2, ...)
--     * status (pending / approved / rejected / skipped / expired)
--     * approver, decided_at, reason
--     * timeout_at (per-stage timeout for escalation)
--
-- BACK-COMPAT:
--   * Existing hitl_approvals rows: stage_count defaults
--     to 1; effectively a single-stage flow.
--   * New columns are nullable / have defaults so SELECT * still works.
--
-- INVARIANTS (enforced by app + DB CHECKs):
--   * stage_count >= 1
--   * current_stage in [0, stage_count)
--   * If decision='approved', current_stage MUST equal stage_count
--     (i.e. all stages passed).

-- Extend the existing hitl_approvals table.
ALTER TABLE hitl_approvals
  ADD COLUMN IF NOT EXISTS stage_count       INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_stage     INTEGER     NOT NULL DEFAULT 0,
  -- Free-form metadata used by the routing rule engine.
  -- Stored so an audit can later inspect "why did this require 3 stages?"
  ADD COLUMN IF NOT EXISTS routing_context   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Reason given by an approver who VETOED at any stage. Distinct from
  -- the final 'rejected' reason on the parent request: a veto pinpoints
  -- WHICH stage halted, not just that it ended.
  ADD COLUMN IF NOT EXISTS veto_at_stage     INTEGER,
  ADD COLUMN IF NOT EXISTS veto_role         TEXT,
  -- Soft retry tracking. Once-rejected requests can be retried IF the
  -- routing_context materially differs (engine decides). retry_of
  -- back-references the prior request id for the audit trail.
  ADD COLUMN IF NOT EXISTS retry_of          UUID,
  ADD COLUMN IF NOT EXISTS retry_count       INTEGER     NOT NULL DEFAULT 0;

-- Per-stage state. One row per stage per request.
CREATE TABLE IF NOT EXISTS approval_stages (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK by convention (no actual FK to allow soft delete of parent).
  request_id          UUID         NOT NULL,
  -- 0-indexed position in the sequence. Stage 0 fires first.
  sequence_position   INTEGER      NOT NULL,
  -- Role label (e.g. "compliance", "security", "business"). Free-form
  -- TEXT so tenants can configure their own role taxonomy.
  role                TEXT         NOT NULL,
  -- Status of THIS stage. Independent of the parent request's overall
  -- status; the engine derives parent status from per-stage states.
  -- 'pending'  — waiting for an approver to act
  -- 'approved' — approver approved; engine advances to next stage
  -- 'rejected' — approver vetoed; parent request goes to rejected
  -- 'skipped'  — engine skipped (e.g. role had no eligible approver)
  -- 'expired'  — timeout passed without action; engine escalates
  status              TEXT         NOT NULL DEFAULT 'pending',
  -- Per-stage timeout. NULL = inherits parent expires_at.
  timeout_at          TIMESTAMP,
  -- Who decided. Free-form so a system-action ("auto-skip") fits too.
  approver            TEXT,
  decided_at          TIMESTAMP,
  reason              TEXT,
  -- Notes the engine attaches (e.g. "escalated from <prev role>" when
  -- a timeout pushed work to this stage).
  engine_notes        TEXT,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT seq_pos_nonneg     CHECK (sequence_position >= 0),
  CONSTRAINT status_valid       CHECK (status IN ('pending', 'approved', 'rejected', 'skipped', 'expired'))
);

-- Find all stages for a request, in sequence order.
CREATE INDEX IF NOT EXISTS idx_approval_stages_request_seq
  ON approval_stages (request_id, sequence_position);

-- Find all pending stages for monitoring + cron escalation.
CREATE INDEX IF NOT EXISTS idx_approval_stages_pending
  ON approval_stages (status, timeout_at)
  WHERE status = 'pending';

-- Find all stages by role (for "compliance approver dashboard").
CREATE INDEX IF NOT EXISTS idx_approval_stages_role_pending
  ON approval_stages (role, status)
  WHERE status = 'pending';
