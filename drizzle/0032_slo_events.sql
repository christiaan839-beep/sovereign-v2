-- Migration 0032: SLO events — cross-instance uptime + latency storage.
--
-- WHY: `src/lib/slo-tracker.ts` keeps a per-instance ring buffer so the
-- first request on a fresh Vercel lambda shows "awaiting" on the status
-- page. For honest platform-wide numbers we need to persist events so
-- they aggregate across instances + survive restarts.
--
-- SHAPE:
--   endpoint    — the request path (e.g. "/api/agents/leads")
--   ts          — Unix-milliseconds timestamp
--   success     — true/false (boolean)
--   duration_ms — request duration in milliseconds
--   error_code  — structured error code if success = false (from error-codes.ts)
--
-- INDEXING:
--   (endpoint, ts) is the primary read pattern — "last 24h for this endpoint"
--   (ts) is the secondary pattern — "platform-wide last 24h"
--
-- RETENTION:
--   Manual for now. The tracker queries only the latest N events per
--   endpoint; older rows are harmless. A cron DELETE job is Q3 ops work.
--
-- GRACEFUL NO-DB:
--   slo-tracker.ts treats Postgres writes as fire-and-forget. If the DB
--   is down or misconfigured, writes fail silently + the in-memory ring
--   buffer remains the source of truth. No request ever fails because
--   of SLO telemetry.

CREATE TABLE IF NOT EXISTS slo_events (
  id           BIGSERIAL PRIMARY KEY,
  endpoint     TEXT NOT NULL,
  ts           BIGINT NOT NULL,
  success      BOOLEAN NOT NULL,
  duration_ms  INTEGER NOT NULL,
  error_code   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS slo_events_endpoint_ts_idx
  ON slo_events (endpoint, ts DESC);

CREATE INDEX IF NOT EXISTS slo_events_ts_idx
  ON slo_events (ts DESC);
