-- Migration 0038: user appeal queue.
--
-- WHY: FMTI's "user appeal / agent rerun mechanism" subdomain scored
-- 60% before this round. The infra (cryptographically-checksummed
-- replay verification) was already there; the GAP was a user-facing
-- UI to actually FILE an appeal.
--
-- This table stores user-initiated appeals against:
--   - blocked outputs (safety pipeline triggered, user disagrees)
--   - failed runs (user thinks the failure was the platform's fault)
--   - suspended actions (user wants the action re-reviewed)
--
-- The key trust property: every appeal carries a `target_kind` +
-- `target_id` so the policy reviewer can pull the exact forensic
-- record (run detail, audit log row, etc.) without trusting the
-- user's narrative. Cryptographic timestamps in the audit chain
-- prevent backdating.

CREATE TABLE IF NOT EXISTS user_appeals (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT         NOT NULL,
  -- What is being appealed. 'run' = a playbook DAG run; 'output' =
  -- a single agent output that was filtered; 'suspension' = an
  -- account / API-key suspension. Open-ended TEXT so future appeal
  -- categories don't need a migration.
  target_kind TEXT         NOT NULL,
  target_id   TEXT         NOT NULL,
  -- The user's message explaining why they think the action was
  -- wrong. Required, capped at 5000 chars to discourage essays.
  message     TEXT         NOT NULL,
  -- pending | reviewing | upheld | overturned. Lifecycle:
  --   pending     - user has filed; awaiting reviewer pickup
  --   reviewing   - a reviewer has claimed it
  --   upheld      - reviewer confirms the original action; appeal denied
  --   overturned  - reviewer reverses; original action was wrong
  status      TEXT         NOT NULL DEFAULT 'pending',
  -- Reviewer's clerk userId. NULL until a reviewer claims the case.
  reviewer_id TEXT,
  -- Reviewer's response. Visible to the user when status=upheld/overturned.
  reviewer_notes TEXT,
  created_at  TIMESTAMP    DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP
);

-- Per-user lookup powers the /dashboard/appeals page.
CREATE INDEX IF NOT EXISTS idx_user_appeals_user_created
  ON user_appeals (user_id, created_at DESC);

-- Reviewer queue: pending appeals across all users, oldest first.
CREATE INDEX IF NOT EXISTS idx_user_appeals_pending
  ON user_appeals (created_at)
  WHERE status = 'pending';

-- Useful for "did this user already appeal this run?" duplicate
-- detection at file time.
CREATE INDEX IF NOT EXISTS idx_user_appeals_target
  ON user_appeals (target_kind, target_id);
