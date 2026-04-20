-- Closes a critical v8 security finding: org_members had no UNIQUE
-- constraints, letting an attacker pre-register a row with a victim's
-- email OR with userId colliding with a future Clerk ID ("user_XXX")
-- that the victim would inherit on signup.
--
-- Two constraints:
--   1. UNIQUE (org_id, user_id) — no duplicate "accepted" members
--   2. UNIQUE (org_id, email)   — no duplicate pending invites
--
-- The existing idempotency check in POST /api/_teams/members already
-- reads the email; this adds the DB-level guarantee so a race or
-- direct DB manipulation can't bypass it.
--
-- We also add a CHECK constraint rejecting emails that look like Clerk
-- IDs (prefix `user_`) — prevents the userId-collision attack where a
-- malicious admin pre-inserts user_XYZ as the email, then the real
-- user_XYZ signs up and gets silently bound to that row.

-- Drop duplicate rows first (defensive — should be no-op on fresh DB,
-- protective if the table has been written against already).
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY org_id, user_id ORDER BY joined_at ASC
         ) AS rn
  FROM org_members
)
DELETE FROM org_members WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

WITH email_duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY org_id, email ORDER BY joined_at ASC
         ) AS rn
  FROM org_members
)
DELETE FROM org_members WHERE id IN (SELECT id FROM email_duplicates WHERE rn > 1);

-- Constraints
ALTER TABLE "org_members"
  ADD CONSTRAINT "uniq_org_members_org_user"
  UNIQUE ("org_id", "user_id");

ALTER TABLE "org_members"
  ADD CONSTRAINT "uniq_org_members_org_email"
  UNIQUE ("org_id", "email");

-- Block emails shaped like Clerk IDs. This is a defense-in-depth
-- measure alongside the application-layer check at /api/_teams/members.
-- We use a CHECK rather than a trigger so it applies to direct SQL too.
ALTER TABLE "org_members"
  ADD CONSTRAINT "chk_org_members_email_not_clerk_id"
  CHECK ("email" !~ '^user_[A-Za-z0-9]+$');
