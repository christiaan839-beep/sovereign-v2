# Runbook: Database is down

## Symptoms

- `/api/health/ready` returns 503 with `failures: ["db:down"]`
- Sentry: `NeonDbError`, `getaddrinfo ENOTFOUND`, or `connection terminated unexpectedly`
- Dashboard: agent runs return 500, "Something went wrong while running this agent"
- `/api/health` (the always-200 liveness probe) reports `services.db = "unreachable"`

## Diagnose

1. Hit the readiness probe directly:

   ```bash
   curl -i https://sovereignmatrix.agency/api/health/ready
   ```

   Confirm `db.status` is `down` or `degraded`. Note the `detail` field —
   it tells you whether it's a connection failure or a query failure.

2. Check Neon status: <https://neonstatus.com/> and the Neon Console.

3. From a local shell with the production `DATABASE_URL`:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```
   If this fails, the issue is the database itself — not the app.

## Fix

**If Neon shows an outage**: nothing to fix from our side. Subscribe to
their status page, post a notice to users via the status endpoint.

**If the connection string is wrong** (eg. you rotated the password and
forgot to update Vercel):

1. Vercel → Project → Settings → Environment Variables
2. Update `DATABASE_URL` for the affected environment(s)
3. Redeploy from the Vercel dashboard (Deployments → Redeploy)

**If the database is sleeping** (Neon scale-to-zero on free tier):
The first request after sleep takes ~5s. The probe should self-recover
within a minute. If it doesn't, set `pooler` mode in the connection string.

**If the connection pool is exhausted** (you'll see `too many connections`):

1. Neon Console → Roles → check active sessions
2. If a deploy left zombie connections, restart the Vercel deployment
3. Long-term: enable PgBouncer pooling in the Neon connection string

## Verify

```bash
curl -s https://sovereignmatrix.agency/api/health/ready | jq '.ready'
# expect: true
```

Then run a real agent to confirm DB writes work end-to-end (use the
golden-path smoke):

```bash
E2E_BASE_URL=https://sovereignmatrix.agency npm run smoke
```

## Postmortem

- Did the readiness probe catch this before customers complained? If not,
  what additional probe should be added to `/api/health/ready`?
- Was Sentry release tracking on? If you couldn't link the error to a
  commit, audit `next.config.ts` for `withSentryConfig`.
- Add a regression test if a code path didn't gracefully degrade
  (eg. a route should return empty array, not 500, on `42P01`).
