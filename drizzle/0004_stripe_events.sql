-- Stripe webhook deduplication table with two-state processing.
-- See src/db/schema.ts:stripeEvents for the design rationale.

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "event_id"      TEXT PRIMARY KEY,
  "type"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'received',
  "received_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at"  TIMESTAMP,
  "error_message" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_stripe_events_status"    ON "stripe_events" ("status");
CREATE INDEX IF NOT EXISTS "idx_stripe_events_received"  ON "stripe_events" ("received_at");

-- If you applied the previous single-state version, run:
--   ALTER TABLE "stripe_events" ADD COLUMN IF NOT EXISTS "status"        TEXT NOT NULL DEFAULT 'completed';
--   ALTER TABLE "stripe_events" ADD COLUMN IF NOT EXISTS "received_at"   TIMESTAMP NOT NULL DEFAULT NOW();
--   ALTER TABLE "stripe_events" ADD COLUMN IF NOT EXISTS "completed_at"  TIMESTAMP;
--   ALTER TABLE "stripe_events" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
--   ALTER TABLE "stripe_events" RENAME COLUMN "processed_at" TO "completed_at";
