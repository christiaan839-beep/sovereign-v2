# Runbook — Row-Level Security enforcement (Phase 2)

## What this is

Postgres Row-Level Security as a defense-in-depth layer for multi-tenant
isolation. Today, isolation is enforced by where-clause discipline at the
ORM layer. RLS adds a second gate at the database itself.

**Phase 1** ships the infrastructure: RLS is enabled on tenant-scoped
tables with a permissive policy that allows everything. This is a no-op
for the running app — it does not break any query — but lays the
foundation. See `drizzle/0019_rls_defense_in_depth.sql`.

**Phase 2** flips the permissive policy for strict per-tenant policies.
This is the runbook below. It requires a coordinated app + DB change
because of how the current connection layer works.

---

## Why Phase 2 is gated on a connection-layer change

The app uses `@neondatabase/serverless`'s **HTTP driver**
(`drizzle-orm/neon-http`). Each query is a stateless HTTPS request —
no persistent connection, no transaction across queries, no
session variable that survives between calls.

Standard RLS uses `current_setting('app.current_user_id', true)` inside
policies, with the app calling `SET LOCAL app.current_user_id = '<id>'`
at the start of each transaction. That pattern requires either:

- A **persistent connection** (the WS driver — `Pool` / `Client` from
  `@neondatabase/serverless`), or
- A **transaction wrapper** that batches `set_config(...)` + the actual
  query into one round-trip.

With the current HTTP driver, neither is straightforward. You cannot
just turn on strict policies — every query would return zero rows
because the session variable is never set.

---

## The two paths to Phase 2

### Path A — Switch to the WS driver, then enforce RLS (recommended)

This is the long-term right answer. The WS driver supports transactions
and session variables, and matches how production Postgres apps work.

Steps:

1. Add `@neondatabase/serverless` Pool to `src/db/index.ts` alongside
   the existing HTTP driver. Don't replace the HTTP one — gate the WS
   driver behind a `TENANT_ENFORCED` env flag so you can roll back fast.
2. Write `withTenantContext(userId, fn)` in a new file
   `src/db/tenant-context.ts`:

   ```ts
   export async function withTenantContext<T>(
     userId: string,
     fn: (tx: NodePgDatabase) => Promise<T>,
   ): Promise<T> {
     const client = await pool.connect();
     try {
       await client.query("BEGIN");
       await client.query(
         "SELECT set_config('app.current_user_id', $1, true)",
         [userId],
       );
       const tx = drizzle(client, { schema });
       const result = await fn(tx);
       await client.query("COMMIT");
       return result;
     } catch (err) {
       await client.query("ROLLBACK");
       throw err;
     } finally {
       client.release();
     }
   }
   ```

3. Migrate routes one at a time: every `db.query.X.findMany(...)` call
   inside an authenticated route gets wrapped in `withTenantContext(userId, db => ...)`.
   Routes that genuinely need cross-tenant access (admin, cron, system
   user) keep using the unscoped `db` client and run as a Postgres role
   with `BYPASSRLS`.
4. Once every authenticated route is wrapped, run the **Phase 2 SQL**
   below in Neon Console. This drops the permissive policies and
   replaces them with strict per-row checks.
5. Smoke-test for 24 hours under the `TENANT_ENFORCED=true` flag, then
   delete the flag and the unscoped fallback paths.

### Path B — Keep HTTP driver, use signed JWTs + policy functions

Less common, more bespoke. Skip unless Path A is genuinely blocked.

1. Have the app sign a short-lived JWT containing the userId per request.
2. Pass the JWT in `request_id`-style header → captured by Neon's pgBouncer
   middleware → injected as a session variable.
3. Policies read from the injected variable.

This is brittle. Don't pick this path unless Path A is impossible.

---

## Phase 2 SQL (run AFTER `withTenantContext` ships in production)

Run this in Neon SQL Editor only after every authenticated route has
been migrated to wrap its queries in `withTenantContext(userId, ...)`.

```sql
DO $$
DECLARE
  rls_table TEXT;
  user_id_col TEXT;
  protected_tables JSONB := '[
    {"table": "subscriptions", "col": "user_id"},
    {"table": "payments", "col": "user_id"},
    {"table": "api_keys", "col": "user_id"},
    {"table": "chat_messages", "col": "user_id"},
    {"table": "conversations", "col": "user_id"},
    {"table": "tenant_memories", "col": "user_id"},
    {"table": "voice_calls", "col": "user_id"},
    {"table": "audit_logs", "col": "user_id"},
    {"table": "client_projects", "col": "user_id"},
    {"table": "leads", "col": "user_email"},
    {"table": "ad_creatives", "col": "user_email"},
    {"table": "email_sequences", "col": "user_id"},
    {"table": "sequence_steps", "col": "user_id"},
    {"table": "bookings", "col": "user_id"},
    {"table": "generations", "col": "user_id"},
    {"table": "usage", "col": "user_id"},
    {"table": "oauth_connections", "col": "user_id"},
    {"table": "agent_activity", "col": "user_id"},
    {"table": "graph_nodes", "col": "user_id"},
    {"table": "graph_edges", "col": "user_id"},
    {"table": "playbook_runs", "col": "user_id"},
    {"table": "playbook_run_steps", "col": "user_id"},
    {"table": "jobs", "col": "user_id"},
    {"table": "workflows", "col": "user_id"},
    {"table": "scheduled_runs", "col": "user_id"},
    {"table": "scheduled_content", "col": "user_id"},
    {"table": "cta_clicks", "col": "user_id"},
    {"table": "whitelabel_config", "col": "user_id"},
    {"table": "custom_skills", "col": "user_id"}
  ]'::JSONB;
  entry JSONB;
BEGIN
  FOR entry IN SELECT * FROM jsonb_array_elements(protected_tables) LOOP
    rls_table := entry->>'table';
    user_id_col := entry->>'col';

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=rls_table) THEN
      -- Drop the Phase 1 permissive policy.
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I',
                     rls_table || '_phase1_permissive', rls_table);

      -- Strict policy: every row must match the current user.
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL ' ||
        'USING (%I = current_setting(''app.current_user_id'', true)) ' ||
        'WITH CHECK (%I = current_setting(''app.current_user_id'', true))',
        rls_table || '_phase2_strict',
        rls_table,
        user_id_col,
        user_id_col
      );

      RAISE NOTICE 'RLS strict policy installed on % (column: %)',
                   rls_table, user_id_col;
    END IF;
  END LOOP;
END $$;

INSERT INTO rls_phase_state (phase, notes)
VALUES (2, 'Strict per-tenant RLS active. Every authenticated route MUST wrap queries in withTenantContext().')
ON CONFLICT (phase) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
```

---

## Verification

After Phase 2:

```sql
-- Should return zero rows when no session variable set:
SELECT * FROM subscriptions LIMIT 1;

-- Should return only one user's rows:
SELECT set_config('app.current_user_id', 'user_xxx', true);
SELECT * FROM subscriptions;

-- Confirm phase state:
SELECT * FROM rls_phase_state ORDER BY phase;
```

In the app, sample a few endpoints:

- `/api/usage/summary` — returns the caller's row only.
- `/api/user/plan` — returns the caller's plan/subscription only.
- `/api/agents/leads` (list) — returns only the caller's leads.

If any endpoint returns zero rows when it shouldn't, the route was not
migrated to `withTenantContext`. Roll back by replacing the strict
policy with the permissive one until the route is fixed.

---

## Rollback

If Phase 2 breaks production:

```sql
-- Revert each strict policy to permissive (no app code change needed):
DO $$
DECLARE
  rls_table TEXT;
  protected_tables TEXT[] := ARRAY[
    'subscriptions','payments','api_keys','chat_messages','conversations',
    'tenant_memories','voice_calls','audit_logs','client_projects','leads',
    'ad_creatives','email_sequences','sequence_steps','bookings','generations',
    'usage','oauth_connections','agent_activity','graph_nodes','graph_edges',
    'playbook_runs','playbook_run_steps','jobs','workflows','scheduled_runs',
    'scheduled_content','cta_clicks','whitelabel_config','custom_skills'
  ];
BEGIN
  FOREACH rls_table IN ARRAY protected_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I',
                   rls_table || '_phase2_strict', rls_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
      rls_table || '_phase1_permissive', rls_table
    );
  END LOOP;
END $$;
```

The app will work normally on permissive policies while you triage.

---

## What this is NOT

- **It is not a substitute for where-clause discipline.** Routes still
  must filter by `userId` — RLS is the safety net, not the primary
  defense. Lint/code review must continue to catch missing filters.
- **It does not protect against bugs in the Postgres role itself.** If
  the app uses a `BYPASSRLS` role for everything, RLS is silently a
  no-op. The Neon role used by the app must be `NOFORCE NOBYPASSRLS`.
- **It does not encrypt data at rest.** RLS controls visibility, not
  storage. For at-rest encryption, use Neon's built-in encryption.
