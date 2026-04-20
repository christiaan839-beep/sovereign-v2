-- Proposal L — Founder Network membership.
-- Separate from the FREE 10-slot Founders program (which flips `plan`
-- to "founder"); the Founder Network is a 100-slot cohort of PAYING
-- customers with a 50% lifetime discount + 30% referral commission.
-- See src/lib/plans.ts::FOUNDER_NETWORK_MAX.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "founder_network_joined_at" TIMESTAMP;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "founder_network_slot" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_subscriptions_founder_network"
  ON "subscriptions" ("founder_network_joined_at");
