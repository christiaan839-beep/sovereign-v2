-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) — defense-in-depth for tenant-scoped tables
-- ============================================================================
--
-- Application code already filters by user_id in every Drizzle query. RLS
-- adds a database-level guarantee: even if a future query forgets the WHERE
-- clause, the DB silently returns zero rows instead of leaking another
-- tenant's data.
--
-- How it works:
--   1. Enable RLS on every tenant-scoped table.
--   2. Each policy compares the row's user_id (text or uuid) to a session-
--      local setting: current_setting('app.current_user_id', true).
--   3. Request handlers call `SET LOCAL app.current_user_id = '<clerk_id>'`
--      at the start of each authenticated request (see src/db/with-tenant.ts).
--      `SET LOCAL` scopes to the current transaction, so nothing leaks
--      across requests.
--
-- Fail-safe behavior:
--   - If SET LOCAL is never called, current_setting returns '' and the
--     policy evaluates false — zero rows visible. This is correct:
--     unauthenticated queries should see nothing.
--   - Neon transaction pooler resets session-state between connections,
--     so we use `true` as the second arg to current_setting (returns NULL
--     on missing instead of erroring).
--
-- Exception: the `stripe_events` dedup table is NOT tenant-scoped — it
-- tracks webhook idempotency globally. No policy; RLS stays off.
-- ============================================================================

-- Helper function — safe read of session user_id.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    ''
  );
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- settings (user-level keys/preferences)
-- Schema uses user_email as the tenant key. We compare to the session-local
-- value either way.
-- ---------------------------------------------------------------------------
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_owner" ON "settings";
CREATE POLICY "settings_owner" ON "settings"
  USING (user_email = app_current_user_id())
  WITH CHECK (user_email = app_current_user_id());

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_owner" ON "leads";
CREATE POLICY "leads_owner" ON "leads"
  USING (user_email = app_current_user_id())
  WITH CHECK (user_email = app_current_user_id());

-- ---------------------------------------------------------------------------
-- email_sequences
-- ---------------------------------------------------------------------------
ALTER TABLE "email_sequences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_sequences_owner" ON "email_sequences";
CREATE POLICY "email_sequences_owner" ON "email_sequences"
  USING (user_email = app_current_user_id())
  WITH CHECK (user_email = app_current_user_id());

-- ---------------------------------------------------------------------------
-- generations (saved outputs library)
-- ---------------------------------------------------------------------------
ALTER TABLE "generations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "generations_owner" ON "generations";
CREATE POLICY "generations_owner" ON "generations"
  USING (user_email = app_current_user_id())
  WITH CHECK (user_email = app_current_user_id());

-- ---------------------------------------------------------------------------
-- usage (metering)
-- ---------------------------------------------------------------------------
ALTER TABLE "usage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_owner" ON "usage";
CREATE POLICY "usage_owner" ON "usage"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- subscriptions (billing)
-- ---------------------------------------------------------------------------
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_owner" ON "subscriptions";
CREATE POLICY "subscriptions_owner" ON "subscriptions"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- scheduled_runs (cron jobs)
-- ---------------------------------------------------------------------------
ALTER TABLE "scheduled_runs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_runs_owner" ON "scheduled_runs";
CREATE POLICY "scheduled_runs_owner" ON "scheduled_runs"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- agent_activity (inbox)
-- ---------------------------------------------------------------------------
ALTER TABLE "agent_activity" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_activity_owner" ON "agent_activity";
CREATE POLICY "agent_activity_owner" ON "agent_activity"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- api_keys (user-issued API keys for external integrations)
-- ---------------------------------------------------------------------------
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_owner" ON "api_keys";
CREATE POLICY "api_keys_owner" ON "api_keys"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- ---------------------------------------------------------------------------
-- playbook_runs + steps
-- Steps join to runs; we restrict via run_id ownership.
-- ---------------------------------------------------------------------------
ALTER TABLE "playbook_runs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "playbook_runs_owner" ON "playbook_runs";
CREATE POLICY "playbook_runs_owner" ON "playbook_runs"
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

ALTER TABLE "playbook_run_steps" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "playbook_run_steps_owner" ON "playbook_run_steps";
CREATE POLICY "playbook_run_steps_owner" ON "playbook_run_steps"
  USING (run_id IN (SELECT id FROM "playbook_runs" WHERE user_id = app_current_user_id()))
  WITH CHECK (run_id IN (SELECT id FROM "playbook_runs" WHERE user_id = app_current_user_id()));

-- ---------------------------------------------------------------------------
-- SERVICE ROLE BYPASS
-- Background jobs (cron scheduler, Stripe webhook, migrations) need to
-- operate across all tenants. They should connect with a role that is
-- granted BYPASSRLS. In Neon, create a dedicated role:
--
--   CREATE ROLE sovereign_service WITH LOGIN BYPASSRLS;
--
-- Use it only for:
--   - /api/cron/*                  (scheduler, job-runner)
--   - /api/_payments/stripe/webhook (writes subscriptions across users)
--   - Drizzle migrations
--
-- User-facing requests use the default DATABASE_URL role which RLS applies
-- to. Keep the two connection strings separate in env:
--   DATABASE_URL               — RLS-enforced (normal role)
--   DATABASE_URL_SERVICE       — RLS-bypass (system role, keep secret)
-- ---------------------------------------------------------------------------
