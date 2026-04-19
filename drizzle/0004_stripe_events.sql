-- Stripe webhook deduplication table.
-- Stripe delivers each event at-least-once. We INSERT event.id on receipt;
-- the unique primary key blocks dup processing so retries become no-ops.

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "event_id"     TEXT PRIMARY KEY,
  "type"         TEXT NOT NULL,
  "processed_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_stripe_events_processed" ON "stripe_events" ("processed_at");
