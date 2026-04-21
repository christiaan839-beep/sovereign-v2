# Scheduled Playbooks — Deployment Runbook

Plan 5 is fully shipped in code. This runbook covers the manual steps
to activate scheduled-playbooks in production. Budget: 15 minutes.

## Prerequisites

- Neon Postgres access (SQL Editor)
- Vercel Dashboard access (Crons + env vars already set for Plan 1 /
  Revenue Engine should be reused — `CRON_SECRET` is the one we need)

## Step 1 — Apply migrations 0022 + 0023 (2 min)

Neon Console → SQL Editor. Run in order:

```bash
# First: the schedules table
drizzle/0022_scheduled_playbooks.sql

# Second: link column on playbook_runs
drizzle/0023_playbook_run_scheduled_id.sql
```

**Verify:**

```sql
SELECT count(*) FROM scheduled_playbooks;   -- returns 0
SELECT scheduled_id FROM playbook_runs LIMIT 1; -- column exists, returns NULL
```

## Step 2 — Confirm env vars (1 min)

`CRON_SECRET` (already set for Plan 1) is all you need. Verify in
Vercel → Settings → Environment Variables.

Length check — service layer will log loudly if `CRON_SECRET` is
shorter than 16 chars:

```
echo $CRON_SECRET | wc -c   # should be ≥ 16
```

## Step 3 — Deploy (2 min)

Push to `main`. Vercel auto-deploys. Watch for:

- Build succeeds
- Vercel Crons → shows `/api/cron/dispatch-scheduled-playbooks`
  scheduled every minute (`* * * * *`)

## Step 4 — Smoke test (8 min)

### 4a. Create a "every minute" test schedule

```bash
curl -X POST https://sovereignmatrix.agency/api/playbooks/scheduled \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<your clerk session>" \
  -d '{
    "playbook_id": "lead-blitz",
    "inputs": { "niche": "test", "location": "test" },
    "cron_expression": "* * * * *",
    "timezone": "UTC"
  }'
```

Should return `{schedule: {...}}` with HTTP 201.

### 4b. Wait 60-90 seconds, then verify dispatch fired

```bash
# Check the cron ran
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sovereignmatrix.agency/api/cron/dispatch-scheduled-playbooks

# Expected:
# { "ok": true, "dispatched": 1, "failed": 0 }
```

Or check Vercel Dashboard → Crons → `dispatch-scheduled-playbooks`
→ last run status should be 200 with dispatched > 0.

### 4c. Verify the run was linked

```sql
-- In Neon SQL Editor
SELECT id, playbook_id, scheduled_id, status, created_at
FROM playbook_runs
WHERE scheduled_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Should show 1+ rows with `scheduled_id` populated matching the
schedule you created in 4a.

### 4d. Verify the schedule was advanced

```sql
SELECT id, cron_expression, next_run_at, last_run_at,
       run_count, failure_count, active
FROM scheduled_playbooks
WHERE cron_expression = '* * * * *';
```

After 2+ minutes:
- `run_count` should be ≥ 2
- `last_run_at` should be within the last minute
- `next_run_at` should be in the future
- `active` should still be `true`

### 4e. Delete the test schedule

Via the dashboard at `/dashboard/scheduled` — click the trash icon on
the card — OR via API:

```bash
curl -X DELETE https://sovereignmatrix.agency/api/playbooks/scheduled/<id> \
  -H "Cookie: __session=<session>"
```

### 4f. UI smoke test

1. Go to `/dashboard/scheduled`
2. Click "New schedule"
3. Pick a playbook from the dropdown
4. Fill in required fields
5. Pick "Weekly" cadence, Monday, 09:00, your local timezone
6. Verify the "Cron: 0 9 * * 1" preview appears
7. Click "Create schedule" — card should appear in the grid
8. Toggle it off — card goes grey, cron stops dispatching it

## Step 5 — Rollback

If anything goes sideways:

```bash
# Revert the Plan 5 commits (newest first)
git revert 259f1a32 be38cee5 b3b2c68f d5012064 9baf5278 b4af3d02
git push origin main
```

DB rollback (only if you need to drop the schema):

```sql
DROP TABLE IF EXISTS scheduled_playbooks CASCADE;
ALTER TABLE playbook_runs DROP COLUMN IF EXISTS scheduled_id;
```

Safe either way — the dispatcher cron won't find any schedules if
the table is gone; the run route gracefully handles missing
scheduled_id (it's optional).

## What's NOT live yet (open items)

- **Per-tier schedule limits**: all users share the same 25-schedule
  cap. In a future iteration, tier the cap (Free 3, Growth 25, Node
  100, Enterprise unlimited).
- **Missed-run catchup**: if the dispatcher is delayed >1 tick and a
  schedule's `next_run_at` is ~5 min in the past, it fires ONCE
  (current behavior). No retroactive "run for every minute missed."
  Document this in user-facing copy; most users want the skip
  behavior anyway.
- **Schedule detail view**: `/dashboard/scheduled/[id]` route that
  shows past runs triggered by this schedule. The data is there
  (runs have `scheduled_id`), just need the UI.
- **Email notifications on schedule auto-pause**: when
  `failure_count >= 5` → active=false, send the user an email.
  Currently silent, which is a mild bug.
