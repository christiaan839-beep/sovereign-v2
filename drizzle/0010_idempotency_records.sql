-- Idempotency keys for non-idempotent API routes (refunds, paid agent runs).
-- See src/lib/idempotency.ts for the protocol.
--
-- Lifecycle
--   pending   — a request has claimed the key but hasn't finished yet
--   completed — request succeeded; body caches the 2xx response
--   failed    — request failed deterministically; body caches the 4xx/5xx
--
-- Retention: rows older than 24 hours are pruned by a weekly cleanup job.
-- We keep the TTL short to limit PII exposure in cached response bodies.

CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "key" TEXT PRIMARY KEY,
  "endpoint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  "http_status" INTEGER,
  "body" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_idempotency_endpoint_created"
  ON "idempotency_records" ("endpoint", "created_at" DESC);

-- Clean up records older than 24 hours. The function is INVOKER-safety
-- because the cleanup cron runs as the service role.
CREATE OR REPLACE FUNCTION prune_idempotency_records() RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_records
  WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;
