-- ============================================================================
-- 0019_rls_defense_in_depth.sql
-- ============================================================================
-- Postgres Row-Level Security as a defense-in-depth layer for multi-tenant
-- isolation. Today, isolation is enforced by where-clause discipline at the
-- ORM layer (every query filters by user_id/tenant_id). RLS adds a second
-- gate at the database itself: even if a query forgets the WHERE clause,
-- the database refuses to leak rows belonging to another user.
--
-- Strategy (safe-by-default, two-phase):
--   Phase 1 (this migration): ENABLE RLS on the tenant-scoped tables, with
--     a permissive default policy that allows ALL operations. This is a
--     no-op for the running app — it will not break any query — but lays
--     the foundation for Phase 2.
--
--   Phase 2 (future operator action, see docs/runbooks/rls-enforcement.md):
--     Drop the permissive policy and replace it with strict policies that
--     gate every row by current_setting('app.current_user_id'). Requires
--     the app's DB connection layer to set this variable per request via
--     withTenantContext() — see src/db/tenant-context.ts.
--
-- Why two phases:
--   - Phase 1 is reversible and safe to deploy immediately.
--   - Phase 2 requires the app code (withTenantContext wrapper) to be
--     deployed FIRST, otherwise every query returns zero rows.
--
-- To apply Phase 1:  paste this file into Neon SQL Editor and run.
-- To roll back:      paste the rollback block at the bottom and run.
-- ============================================================================

-- ─── Tables we protect ──────────────────────────────────────────────────────
-- Picked the highest-risk tables: anything containing PII, payments, or
-- agent output that could leak across tenants. Tables holding only system
-- state (e.g. global_telemetry) are intentionally excluded.

DO $$
DECLARE
  rls_table TEXT;
  protected_tables TEXT[] := ARRAY[
    'subscriptions',
    'payments',
    'api_keys',
    'chat_messages',
    'conversations',
    'tenant_memories',
    'voice_calls',
    'audit_logs',
    'client_projects',
    'leads',
    'ad_creatives',
    'email_sequences',
    'sequence_steps',
    'bookings',
    'generations',
    'usage',
    'oauth_connections',
    'agent_activity',
    'graph_nodes',
    'graph_edges',
    'playbook_runs',
    'playbook_run_steps',
    'jobs',
    'workflows',
    'scheduled_runs',
    'scheduled_content',
    'cta_clicks',
    'whitelabel_config',
    'custom_skills'
  ];
BEGIN
  FOREACH rls_table IN ARRAY protected_tables LOOP
    -- Only enable if the table actually exists (some tables may not have
    -- been created yet on this database — earlier migrations gated them).
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = rls_table
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rls_table);

      -- Permissive default policy: allow everything for now. Phase 2 will
      -- replace this with strict per-tenant policies.
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
        rls_table || '_phase1_permissive',
        rls_table
      );

      RAISE NOTICE 'RLS enabled (permissive) on %', rls_table;
    ELSE
      RAISE NOTICE 'Skipped — table does not exist: %', rls_table;
    END IF;
  END LOOP;
END $$;

-- ─── Bookkeeping marker so the runbook can detect Phase 1 was applied ──────
CREATE TABLE IF NOT EXISTS rls_phase_state (
  phase INT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

INSERT INTO rls_phase_state (phase, notes)
VALUES (1, 'Permissive RLS enabled on tenant-scoped tables. Run Phase 2 only after withTenantContext() ships.')
ON CONFLICT (phase) DO NOTHING;

-- ============================================================================
-- ROLLBACK BLOCK (run only if Phase 1 needs to be undone)
-- ============================================================================
--   DO $$
--   DECLARE
--     rls_table TEXT;
--     protected_tables TEXT[] := ARRAY[
--       'subscriptions','payments','api_keys','chat_messages','conversations',
--       'tenant_memories','voice_calls','audit_logs','client_projects','leads',
--       'ad_creatives','email_sequences','sequence_steps','bookings','generations',
--       'usage','oauth_connections','agent_activity','graph_nodes','graph_edges',
--       'playbook_runs','playbook_run_steps','jobs','workflows','scheduled_runs',
--       'scheduled_content','cta_clicks','whitelabel_config','custom_skills'
--     ];
--   BEGIN
--     FOREACH rls_table IN ARRAY protected_tables LOOP
--       IF EXISTS (SELECT 1 FROM information_schema.tables
--                  WHERE table_schema='public' AND table_name=rls_table) THEN
--         EXECUTE format('DROP POLICY IF EXISTS %I ON %I',
--                        rls_table || '_phase1_permissive', rls_table);
--         EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', rls_table);
--       END IF;
--     END LOOP;
--   END $$;
--   DELETE FROM rls_phase_state WHERE phase = 1;
-- ============================================================================
