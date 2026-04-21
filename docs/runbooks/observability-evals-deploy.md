# Observability + Continuous Evals — Deployment Runbook

Plan 4 is fully shipped in code. This runbook turns it on in production.
Budget: 20 minutes (mostly account signups).

## Prerequisites

- Neon Postgres access
- Vercel Dashboard access
- Willingness to create free accounts at Sentry and PostHog (or paid if
  you're past their thresholds — very unlikely at launch-stage traffic)

## Step 1 — Apply migration 0021 (2 min)

Neon Console → SQL Editor → run `drizzle/0021_eval_runs.sql`.

**Verify:**

```sql
SELECT count(*) FROM eval_runs;          -- returns 0
SELECT count(*) FROM eval_run_results;   -- returns 0
```

## Step 2 — Sentry activation (5 min)

1. sentry.io → New Project → Next.js → copy the DSN
2. Vercel env vars:
   ```
   SENTRY_DSN=<from step 1>
   NEXT_PUBLIC_SENTRY_DSN=<same DSN>
   SENTRY_ORG=<your-org-slug>
   SENTRY_PROJECT=<project-slug>
   SENTRY_AUTH_TOKEN=<Auth Tokens → create, scopes: project:releases + org:read>
   ```
3. Redeploy. Look for `✓ Sentry` in the capability-banner Vercel log.

**Verify:** Trigger a harmless error (e.g. hit a non-existent route) and
check sentry.io → Issues — should show up within 30 seconds.

## Step 3 — PostHog activation (3 min)

1. posthog.com (or self-host — free tier is 1M events/month, plenty)
2. New project → copy the Project API Key (starts with `phc_...`)
3. Vercel env vars:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=<phc_...>
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   (or eu.i.posthog.com)
   ```
4. Redeploy.

**Verify:** Sign in to `/dashboard`. Check PostHog → Live events —
within 5 seconds you should see `$pageview` and `$identify`.

## Step 4 — Continuous eval cron (1 min)

No action needed — `vercel.json` already has the entry:

```
{ "path": "/api/cron/run-evals", "schedule": "0 */6 * * *" }
```

Vercel picks it up on the next deploy. First run fires at the next
6-hour boundary (00:00, 06:00, 12:00, 18:00 UTC).

**Verify after first scheduled fire:**

```sql
SELECT id, started_at, trigger, total, passed, failed, pass_rate
FROM eval_runs
ORDER BY started_at DESC
LIMIT 5;
```

Should show one row with `trigger='scheduled'`, `total > 0`.

Also: `/dashboard/admin/eval-health` (admin-only) should render the
sparkline + currently-failing list.

## Step 5 — UptimeRobot on /api/health/deep (5 min)

1. uptimerobot.com → New Monitor → HTTPS
2. URL: `https://sovereignmatrix.agency/api/health/deep`
3. Interval: every 5 minutes
4. Alert threshold: 2 consecutive failures
5. Alert channels: email + Slack webhook + (optionally) PagerDuty

**Verify:** Should show "up" within 10 minutes.

## Step 6 — SLO sample recording (manual hooks, 5 min)

The `recordSample()` hooks aren't yet called from the four sources
(agent factory / playbook engine / Stripe webhook / health cron). Wire
them in when you want the SLO data flowing:

- **health_availability**: add `recordSample("health_availability", 0,
  res.status === 200)` to the `/api/cron/health-probe` endpoint (create
  one if none exists, call from a 1-minute cron)
- **agent_latency_p95**: in `agent-factory.ts` at the success path,
  call `recordSample("agent_latency_p95", durationMs, durationMs <= 8000)`
- **playbook_completion**: in `updateRunStatus` (playbook-step-runner),
  when a run finishes, call `recordSample("playbook_completion",
  totalMs, finalStatus === "done" && totalMs <= 5 * 60_000)`
- **stripe_webhook_ok**: at the top of the Stripe webhook handler,
  wrap the main try/catch with a sample record on success/failure
- **voice_first_audio_p95**: add after Plan 3 (voice agent) ships

Each is a 1-line addition — intentionally left out of this plan to
keep the hot path untouched until the infrastructure is verified.

## Step 7 — Weekly SLO breach cron (not yet wired)

The `classifyBreach()` function is ready but no cron is calling it.
Building this is ~30 min and not strictly required for Plan 4
completion — document as follow-up:

```
Future cron /api/cron/slo-weekly (schedule: '0 9 * * 1'):
  1. Read each SLO's Redis sorted-set for its windowDays
  2. Build SampleSummary
  3. classifyBreach()
  4. If breached: post to SLACK_WEBHOOK_URL
```

## Rollback

```bash
# Revert Plan 4 code (newest first)
git revert 491392a2 a8ea873f c0a27c82 d120c0a0 1bab593a b79f0752 1539242f
git push origin main
```

DB rollback (optional):
```sql
DROP TABLE IF EXISTS eval_run_results CASCADE;
DROP TABLE IF EXISTS eval_runs CASCADE;
```

## What's live after completion

- ✅ Sentry catches every unhandled error with stack + context
- ✅ PostHog tracks the full typed event taxonomy (15 events)
- ✅ Eval drift detector fires on every 6h run, alerts to Sentry on
  pass-rate drops > 5pp or newly-failed evals
- ✅ `/dashboard/admin/eval-health` shows trend sparkline + failing list
- ✅ `/dashboard/admin/cost` shows per-agent/per-user/per-provider
  spend broken out by 7d/30d window
- ✅ SLO breach classifier is ready (5 SLOs defined); sample
  recording awaits the wiring in Step 6
