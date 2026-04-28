-- Migration 0039: public share tokens for visual-editor playbook runs.
--
-- WHY: Round 11 shipped /dashboard/playbooks/runs/[runId] for the
-- owner. That URL is auth-gated. But "share this run with my lawyer
-- / auditor / a teammate without account access" is a real workflow
-- — procurement teams ask for it explicitly during diligence. This
-- migration adds the public-share surface.
--
-- TRUST POSTURE:
--
--   The naive implementation (a public UUID in the URL) is a
--   permanent unauthenticated leak — anyone with the URL gets
--   forever access. We instead require:
--
--     1. **Rotating opaque token** — 192 bits of entropy in the
--        URL. The token is the secret; the runId is the resource.
--        DB stores the token in a UNIQUE index (no collisions, fast
--        lookup, hashed-at-rest is YAGNI for this surface).
--
--     2. **Expiration** — every token has expires_at, default 7
--        days. The resolver checks expiry on every read so even
--        leaked URLs auto-rot.
--
--     3. **Revocability** — owner can flip revoked_at and the link
--        is dead in the next request. Surfaced in the UI as the
--        "Active shares" list on the run-detail page.
--
--     4. **Last-accessed audit** — last_accessed_at + access_count
--        let the owner see "this share was hit 4 times — last 10
--        minutes ago". Distinguishes "shared and used" from "shared
--        and forgotten".
--
--     5. **Per-share label** — owner can tag each share ("Lawyer",
--        "VP Eng review") so a "delete the lawyer link" operation
--        is one click instead of guessing-from-token.
--
-- TENANT ISOLATION: every row carries user_id matching the run's
-- owner. The resolver verifies the share's run_id is still owned by
-- the share's user_id (defends against the edge case where a run is
-- deleted and then a new run reuses the id — vanishingly unlikely
-- with UUIDs but cheap to verify).

CREATE TABLE IF NOT EXISTS dag_run_shares (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID         NOT NULL REFERENCES playbook_dag_runs(id) ON DELETE CASCADE,
  -- Owner of the run. Carried denormalised so revocation queries
  -- can scope by user without joining playbook_dag_runs.
  user_id         TEXT         NOT NULL,
  -- The opaque secret in the URL. UNIQUE so collisions impossible.
  -- 32 hex chars = 128 bits. We can extend to 48 chars (192 bits)
  -- without migration if we want more entropy headroom later.
  token           TEXT         NOT NULL UNIQUE,
  -- Owner-supplied label (optional). "Lawyer review", "Q3 audit", etc.
  label           TEXT,
  -- Default 7 days from create. Long enough for most diligence
  -- flows, short enough that forgotten links don't hang around.
  expires_at      TIMESTAMP    NOT NULL,
  -- Set when revoked. NULL = active. Soft-delete pattern; we keep
  -- the row for audit (the SHA-256 chain has the revoke event but
  -- this is the index lookup).
  revoked_at      TIMESTAMP,
  -- Bumped on every successful resolve. The UI shows "last accessed
  -- 10 minutes ago". Helps owners detect surprise traffic.
  last_accessed_at TIMESTAMP,
  -- Counter-only. Useful for the rate-limit decision in the resolver
  -- ("more than 1000 hits/hr on a single share — suspicious") AND
  -- for the owner-facing UI ("this link has been viewed 12 times").
  access_count    INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT NOW() NOT NULL
);

-- Resolver hot path: token → row. The UNIQUE index on `token` already
-- powers this; explicit naming for clarity.
CREATE INDEX IF NOT EXISTS idx_dag_run_shares_token
  ON dag_run_shares (token);

-- "Active shares for this run" — used by the run-detail page's UI.
CREATE INDEX IF NOT EXISTS idx_dag_run_shares_run_active
  ON dag_run_shares (run_id, revoked_at)
  WHERE revoked_at IS NULL;

-- Owner's "list all my shares" surface (future page, not in this round).
CREATE INDEX IF NOT EXISTS idx_dag_run_shares_user_created
  ON dag_run_shares (user_id, created_at DESC);
