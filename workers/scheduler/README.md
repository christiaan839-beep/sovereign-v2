# Cron scheduler — Cloudflare Worker

Runs the platform's ten scheduled jobs. One cron trigger fires every
minute, works out which jobs are due, and issues one authenticated
request per due job at the origin.

It runs **no business logic**. The jobs stay in the Next.js app; this
only replaces the thing calling them.

---

## Why

`vercel.json` declares ten crons. Vercel's Hobby plan caps scheduled jobs
at **once per day**, and six of the ten exceed that — including
`_cron/audit-bundles` and `_cron/soc2-indicators`, the two that generate
compliance evidence. The deploy is rejected outright, so on Hobby the
schedule does not run at all.

Cloudflare Cron Triggers accept `* * * * *` without argument.

**No application change is required.** Every scheduled route already
accepts `Authorization: Bearer $CRON_SECRET` — unified in commit
`0869b31`, before which `_cron/*` checked a different header and would
have silently 401'd here. That header is exactly what this Worker sends.

## Deploy

```bash
cd workers/scheduler
npm install

# Point at wherever the app now lives (no trailing slash).
# Edit "ORIGIN" in wrangler.jsonc, or override per-environment.

npx wrangler secret put CRON_SECRET     # must match the origin's value
npx wrangler deploy
```

Verify it is configured without waiting for a tick:

```bash
curl https://sovereign-cron-scheduler.<subdomain>.workers.dev/
# {"ok":true,"jobs":10,"dueNow":["/api/cron/job-runner", ...]}

# What would fire at a given instant:
curl 'https://.../?at=2026-04-05T03:00:00Z'
```

That endpoint **reports only** — it cannot trigger a job. A scheduler
reachable over the internet that runs jobs on request is an
unauthenticated way to hammer the origin.

Watch it live:

```bash
npx wrangler tail
```

## Design notes

**One trigger, not ten.** The free plan allows 5 Cron Triggers per
account and there are 10 jobs. It also sidesteps a real trap: Cloudflare's
cron parser numbers weekdays `1=Sunday..7=Saturday`, while every
expression in `vercel.json` is standard cron (`0=Sunday`). Handing
`0 3 * * 0` straight to Cloudflare would move the weekly cleanup by a
day, silently. Matching internally keeps the existing expressions exact
and copyable verbatim.

**Cost.** Cloudflare bills Workers on CPU time and explicitly does not
count time awaiting `fetch()`. A tick parses ten cron expressions and
then waits on the network, so it costs well under a millisecond of CPU
even while staying open for seconds. It fits the free plan's 10 ms
budget with room to spare.

**Failure model.** A job that errors, times out, or returns non-2xx is
logged as an error and skipped; the others still run
(`Promise.allSettled`, and `runJob` returns a verdict rather than
throwing). There is **no retry** — the next matching tick is the retry,
which for a once-a-minute job is a minute and for a weekly one is a
week. If a job needs stronger delivery than that, it needs a durable
queue, not a louder scheduler.

**Timeouts.** Each job carries its own `timeoutMs` and is aborted past
it, so one slow endpoint cannot delay the rest of the tick or hold the
Worker open.

## Drift

`src/jobs.ts` is the Worker's schedule. `__tests__/jobs.test.ts` asserts
it still matches `vercel.json` exactly, so the two cannot disagree while
both exist. When Vercel is gone, delete that test with `vercel.json` and
`jobs.ts` stands alone.

## Tests

```bash
npx vitest run workers/          # from the repo root — 32 tests
```

They run as part of the main suite. The cron matcher is checked by
simulating every minute of whole days and asserting the exact firing
count for each of the ten real schedules — a wrong matcher does not
crash, it silently skips a job or fires one twice, so spot-checking two
timestamps is not enough.

## Scope

This Worker is not on the app's TypeScript project (`workers` is in the
root `tsconfig.json` exclude list) because it compiles against
`@cloudflare/workers-types` rather than the Next.js DOM/Node lib set.
It has its own `tsconfig.json`. Its **tests** do run in the root vitest
suite, since the matcher and the schedule are plain TypeScript with no
Cloudflare imports.
