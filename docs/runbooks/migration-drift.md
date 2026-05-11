# Runbook: Migration drift (`42P01` errors)

## Symptoms

- Sentry: `error: relation "<table_name>" does not exist` (Postgres code `42P01`)
- Specific routes 500 while others work fine
- `/api/admin/setup-checklist` shows red ticks under "Database migrations"
- CI's `migration-parity` job fails (or warns, in soft mode)
- `/api/health/ready` is green (DB connection works) but specific endpoints break

## Diagnose

1. **What's missing?** Run the parity check locally with your production
   `DATABASE_URL`:

   ```bash
   DATABASE_URL=<prod-readonly-url> npm run check:migrations
   ```

   The output names every missing table and the migration file that
   creates it.

2. **What's been applied?** Open the admin setup console:
   <https://sovereignmatrix.agency/dashboard/admin/setup>
   Scroll to "Database migrations". Each row probes one table.

3. **Cross-reference the SQL** files in `drizzle/` against the missing
   tables. The script tells you which `.sql` to apply.

## Fix

1. Open the Neon Console → SQL Editor for your project.
2. For each missing migration file (in numeric order):
   - Open `drizzle/<file>.sql` from the repo
   - Copy the whole file
   - Paste into the SQL Editor
   - Click **Run**
3. Re-run the parity check:
   ```bash
   npm run check:migrations
   ```
   Should print `OK — all N tables present.`
4. Hit `/dashboard/admin/setup` and confirm the migration section is all
   green.

## Verify

```bash
# Probe the affected route end-to-end. Use the actual route from Sentry:
curl -i https://sovereignmatrix.agency/api/agents/leads \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"niche":"smoke-test"}'
```

Expect 200, not 500.

## Postmortem

- Why didn't `migration-parity` catch this in CI? Likely because:
  - It's still running with `--soft` (warn only). Once you've cleared all
    drift, flip CI to hard:
    ```yaml
    run: npm run check:migrations # remove `:soft`
    ```
  - `DATABASE_URL_READONLY` wasn't set in GitHub secrets.

- Why was the migration written but not applied? Check whether you've
  installed the pre-push hook (`npm run hooks:install`) — it runs the
  same parity check locally before push.

- Long-term fix: switch to `drizzle-kit migrate` in a release pipeline
  step that runs on every prod deploy. Trade-off: less control over WHEN
  schema changes happen, more guarantees that they happen.
