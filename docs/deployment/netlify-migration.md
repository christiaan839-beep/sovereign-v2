# Netlify migration — assessment

Written 2026-09-03. **No code changed and nothing deployed.** This maps what
would have to move and what is genuinely unknown, so the decision can be made
on evidence.

## Why this is on the table

Vercel is currently refusing to deploy this project for two independent reasons:

1. `Account is blocked.` — an account state, not a code problem.
2. `Deployment failed.` — Vercel Hobby permits **one cron per day**, and
   `vercel.json` declares six sub-daily jobs. The bot names the first one it
   hits: `* * * * *` on `/api/cron/job-runner`.

Reason 2 is the one a platform change can solve. Netlify's Scheduled Functions
document a **minimum interval of one minute**, which is what this project needs.

> Confirm the interval floor against your own Netlify plan before relying on it.
> The figure above comes from Netlify's own coding guidance, which does not state
> plan gating either way.

## Blockers, in the order they will bite

### 1. `output: "standalone"` is emitted on any non-Vercel host

`next.config.ts:7`

```ts
output: process.env.VERCEL ? undefined : "standalone",
```

Netlify does not set `VERCEL`, so a Netlify build takes the standalone branch —
which exists for Docker and Railway, where we run the server ourselves. Netlify's
Next runtime produces its own server output and does not want a standalone bundle.

**Fix is one line**, and it keeps Docker/Railway working:

```ts
output: process.env.VERCEL || process.env.NETLIFY ? undefined : "standalone",
```

This is the first thing to change and the first thing to test, because every
other symptom downstream of a wrong output mode is misleading.

### 2. Six sub-daily crons become Scheduled Functions

`vercel.json` declares ten crons; six are sub-daily. Netlify Scheduled Functions
carry a **30-second execution limit**, which is the constraint that decides
whether this is a port or a redesign.

| Schedule | Path | 30s risk |
|---|---|---|
| `* * * * *` | `/api/cron/job-runner` | **Measure first.** Drains a batch per invocation; batch size is the lever. |
| `*/4 * * * *` | `/api/health/ping` | Low |
| `*/5 * * * *` | `/api/cron/playbook-scheduler` | **Measure.** Kicks off playbook runs. |
| `*/5 * * * *` | `/api/cron/synthetic-probe` | Medium — makes outbound requests. |
| `*/15 * * * *` | `/api/_cron/soc2-indicators` | Low |
| `0 * * * *` | `/api/_cron/audit-bundles` | **Measure.** Signs and assembles bundles. |

A scheduled function that needs longer than 30s should trigger a **background
function** (15-minute limit) rather than do the work inline. That is a real
design change for any job that exceeds the limit, not a config edit.

Scheduled functions **only run on published deploys** — not previews, not branch
deploys. Any cron-dependent behaviour is untestable on a preview URL.

### 3. Middleware

`src/middleware.ts` is 527 lines and its matcher covers effectively every path
plus all of `/api`. It carries Clerk auth, CSRF/origin enforcement, custom-domain
white-label detection, and security headers.

Netlify runs Next middleware as an Edge Function. Two things to verify rather
than assume: that Clerk's middleware works there under this Next version, and
that the custom-domain detection still sees the host header it expects. The
white-label rewrites (`/client/:id/:path` → `/portal/:id/:path`, `/wl/:domain` →
`/portal/d/:domain`) depend on that.

### 4. Runtime declarations across 419 API routes

- 15 files declare `runtime = "edge"`
- 4 declare `runtime = "nodejs"`
- 27 declare `force-dynamic`

`serverExternalPackages` keeps pinecone, twilio, drizzle-orm and neon out of the
client and edge bundles. Any route that declares `edge` and reaches one of those
is a latent failure that Vercel's bundler may currently be masking. This is the
largest unknown in the migration and the only one that scales with route count.

### 5. Security headers and CSP

The full CSP lives in `next.config.ts` `headers()`, along with HSTS,
X-Frame-Options, nosniff, referrer policy, permissions policy, and per-path CORP
overrides for `/badge/:path*` and `/embed/:path*`. Netlify applies `headers()`
from the Next build, but `netlify.toml` headers are a second, overlapping
mechanism. **Pick one.** Two header sources that disagree is how the
middleware/next.config duplication bug from wave 120 happened, and it should not
be recreated on a new host.

## The honest options

**A — Fix the Vercel account, change nothing.** Cheapest by a wide margin. Does
not solve the cron limit; that still needs Pro or option C.

**B — Move the crons off the platform, stay on Vercel.** An external scheduler
(GitHub Actions `schedule`, Upstash QStash) calls the existing endpoints, which
are already `CRON_SECRET`-protected. `instrumentation.ts` already drives
`job-runner` on a 30-second interval for Railway, so the code tolerates external
triggering — that is evidence, not hope. Leaves one daily entry in `vercel.json`.
**Smallest change that actually unblocks deploys.**

**C — Migrate to Netlify.** Solves crons natively at one-minute resolution. Costs
the five blockers above, with item 4 unbounded until measured. Realistically days
of work and a period of running both.

**D — Upgrade Vercel to Pro.** Everything works as designed, no code change.

## Recommendation

**B now, C only if you want off Vercel for reasons beyond cron.** Option B is
hours, uses infrastructure that already exists, and is reversible. The cron limit
is not a good reason to migrate a 419-route application with a 527-line
middleware, because the migration's cost is dominated by item 4, which nobody has
measured yet.

If C is chosen anyway, do it in this order: fix `output` first, deploy a preview
and see what breaks, measure the six jobs against 30 seconds, then port the crons
last. Do not port crons first — scheduled functions do not run on previews, so
they cannot be tested until everything else already works.

## What is not known

- Whether Netlify's one-minute cron floor applies on the intended plan.
- How long each of the six jobs actually takes. Nothing here has been timed.
- Whether the 15 edge-runtime routes are genuinely edge-safe, or currently
  working by accident of Vercel's bundling.
- Whether Clerk middleware behaves identically on Netlify Edge Functions under
  Next.js 16.

Each is a measurement, not a judgement call. None has been done.
