-- 0020_customer_deliveries.sql
-- Per-customer weekly deliveries — the system of record proving
-- STANDARDS.md §03 ("Monday 9am delivery is sacred") was hit.
--
-- One row per (tenant, delivery_date) pair. delivery_date is the
-- Monday the batch is FOR (not the timestamp it was created).
-- lead_count + hand_reviewed_by are required so a row can't exist
-- without proving §01 (hand-review) was met.
--
-- The Monday-watchdog cron reads this table to detect missed
-- deliveries and ping Slack at 8:30am Mon if anyone's unshipped.

CREATE TABLE IF NOT EXISTS "customer_deliveries" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"          uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "delivery_date"      date NOT NULL,
  "lead_count"         integer NOT NULL,
  "hand_reviewed_by"   text NOT NULL,
  "slack_message_url"  text,
  "notes"              text,
  "created_at"         timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_deliveries_tenant_date"
  ON "customer_deliveries" USING btree ("tenant_id", "delivery_date");

CREATE INDEX IF NOT EXISTS "idx_deliveries_date"
  ON "customer_deliveries" USING btree ("delivery_date");
