-- Cost ledger columns on the usage table so every agent run records
-- its input/output tokens + estimated USD cost + provider bucket +
-- correlated request ID.
--
-- Unblocks:
--   - Accurate Anthropic partnership metrics (dollars, not run counts)
--   - Usage-based billing for paid plans
--   - Per-customer margin reporting
--   - Cross-log correlation via request_id
--
-- Legacy rows pre-0012 have NULL in the new columns; aggregates
-- filter them via `WHERE cost_cents IS NOT NULL`.

ALTER TABLE "usage"
  ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "cost_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "request_id" TEXT;

CREATE INDEX IF NOT EXISTS "usage_provider_idx" ON "usage" ("provider");
CREATE INDEX IF NOT EXISTS "usage_request_id_idx" ON "usage" ("request_id");

-- Partial index for "runs that have cost data" — vastly smaller than
-- the full usage table once the ledger is populated, so aggregations
-- over just the post-0012 period are fast.
CREATE INDEX IF NOT EXISTS "usage_cost_recorded_idx"
  ON "usage" ("created_at" DESC, "provider")
  WHERE "cost_cents" IS NOT NULL;
