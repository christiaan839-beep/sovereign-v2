-- Migration 0026: usage cost-ledger columns + subscriptions attribution columns.
--
-- Why this exists:
--   src/db/schema.ts declares usage.{input_tokens,output_tokens,cost_cents,
--   provider,request_id} (the "v9 cost-ledger" columns) and subscriptions.
--   {founder_network_joined_at,founder_network_slot,acquisition_source,
--   acquisition_medium,acquisition_campaign,acquisition_referrer,acquired_at}
--   (Founder Network + v10 acquisition attribution) — but neither set was
--   ever added by an on-disk migration. drizzle/0000 only creates the
--   original 6-column usage table and 9-column subscriptions table.
--
--   Concretely, on a DB built strictly from drizzle/*.sql (not hand-pushed
--   via `db push`), src/lib/budget-controls.ts's `SUM(usage.cost_cents)`
--   query throws Postgres 42P01 (column does not exist). budget-controls
--   fails OPEN on any DB error (by design, so telemetry never blocks a
--   request) — so the daily AI-spend hard cap silently never fires. The
--   Founder Network / acquisition-attribution columns on subscriptions are
--   read by src/app/api/_misc/founders/route.ts and onboarding-emails.ts;
--   without them those code paths hit the same 42P01.
--
-- Safety:
--   Every statement is IF NOT EXISTS / additive-only — nullable columns
--   with the same defaults schema.ts declares. No existing column is
--   altered or dropped. Safe to run against a DB that already has some or
--   all of these columns (e.g. one provisioned via `drizzle-kit push`).
--   Re-running this file is a no-op once applied.
--
-- Operator runbook (paste in Neon → SQL Editor):
--   Run the whole file. Verify with:
--     SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'usage' AND column_name = 'cost_cents';
--     SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'subscriptions' AND column_name = 'acquisition_source';
--   Both should return one row.

-- ── usage: v9 cost-ledger columns ──────────────────────────────────────
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "input_tokens" integer;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "output_tokens" integer;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "cost_cents" integer;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "request_id" text;

CREATE INDEX IF NOT EXISTS "usage_provider_idx" ON "usage" USING btree ("provider");
CREATE INDEX IF NOT EXISTS "usage_request_id_idx" ON "usage" USING btree ("request_id");

-- ── subscriptions: Founder Network + v10 acquisition attribution ──────
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "founder_network_joined_at" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "founder_network_slot" integer;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "acquisition_source" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "acquisition_medium" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "acquisition_campaign" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "acquisition_referrer" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "acquired_at" timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS "idx_subscriptions_founder_network" ON "subscriptions" USING btree ("founder_network_joined_at");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_acq_source" ON "subscriptions" USING btree ("acquisition_source");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_acquired_at" ON "subscriptions" USING btree ("acquired_at");
