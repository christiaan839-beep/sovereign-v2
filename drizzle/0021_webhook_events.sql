-- 0021_webhook_events.sql
-- Webhook event idempotency log. Every inbound webhook (PayPal,
-- Stripe, Clerk, Yoco) is fingerprinted by (provider, event_id) and
-- inserted into this table BEFORE its side effects run. Composite
-- primary key is the dedupe lock — a duplicate event hits 23505 and
-- the handler returns 200 OK without re-running.
--
-- See src/lib/webhook-idempotency.ts for the assertWebhookFresh()
-- helper that wraps every webhook handler.

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "provider"     text NOT NULL,
  "event_id"     text NOT NULL,
  "event_type"   text,
  "status"       text NOT NULL DEFAULT 'processing',
  "processed_at" timestamp,
  "error"        text,
  "received_at"  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("provider", "event_id")
);

CREATE INDEX IF NOT EXISTS "idx_webhook_events_received"
  ON "webhook_events" USING btree ("received_at" DESC);
