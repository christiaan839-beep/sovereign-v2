-- Acquisition source attribution — critical for launch-week channel
-- analysis. Without this, a spike of signups on Tuesday tells us
-- nothing about whether HN or LinkedIn drove it.
--
-- Lifecycle:
--   Stored at signup (read from ?utm_source or document.referrer)
--   Immutable after first write (don't let a user re-attribute later)
--   Never shown to the user directly — internal attribution only

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "acquisition_source" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_medium" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_campaign" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_referrer" TEXT,
  ADD COLUMN IF NOT EXISTS "acquired_at" TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "idx_subscriptions_acq_source"
  ON "subscriptions" ("acquisition_source");

CREATE INDEX IF NOT EXISTS "idx_subscriptions_acquired_at"
  ON "subscriptions" ("acquired_at" DESC);
