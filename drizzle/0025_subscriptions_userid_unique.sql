-- Migration 0025 (Wave 72): add UNIQUE constraint on subscriptions.user_id.
--
-- Why this exists:
--   The Stripe webhook handler at src/app/api/_payments/stripe/webhook/route.ts
--   uses .onConflictDoUpdate({ target: subscriptions.userId, ... }). Postgres
--   rejects ON CONFLICT against a non-unique column with error 42P10. Without
--   this constraint, EVERY checkout.session.completed event throws at the
--   ON CONFLICT clause and Stripe retries indefinitely. Discovered by the
--   architecture review in Wave 72; verified against drizzle/0000 + 0001
--   (only a non-unique btree index was created previously).
--
-- Safety:
--   This statement will FAIL if duplicate user_id rows already exist (i.e.
--   the broken Stripe webhook actually managed to insert duplicates before
--   the ON CONFLICT crash). The verification block below counts duplicates
--   before applying — if any exist, the operator must dedupe manually.
--
-- Operator runbook (paste in Neon → SQL Editor):
--   1. Run the SELECT below. If it returns 0 rows, proceed to ALTER.
--   2. If it returns >0 rows, dedupe (keep most recent per user_id) and rerun.
--   3. The ALTER is idempotent — re-running is a no-op once the constraint exists.

-- Step 1: pre-check for duplicates (read-only).
-- SELECT user_id, COUNT(*) FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1;

-- Step 2: add the constraint.
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- Verification:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'subscriptions'::regclass AND contype = 'u';
-- → should include 'subscriptions_user_id_unique'.
