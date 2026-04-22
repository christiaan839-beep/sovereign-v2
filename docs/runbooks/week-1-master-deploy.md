# Week 1 — Master Deploy Runbook

> **One doc, end-to-end, for getting `claude/wizardly-benz` into production.**
> The individual plan-specific runbooks linked below have the details per
> feature; this is the order + the checklist.

**Estimated time (human-at-keyboard):** 90 minutes, split into a 60-min
active window and two 15-min verification windows.

**Prerequisites:**
- Vercel project dashboard access (production tier)
- Railway account with billing enabled
- Neon Console admin access (production DB)
- Stripe dashboard access (live mode)
- Clerk dashboard access (production instance)
- `gh` CLI authenticated, branch permissions on `main`

---

## Phase 0 — Pre-flight (5 min)

From the repo root on the feature branch:

```bash
# Confirm the branch
git branch --show-current   # expect: claude/wizardly-benz

# Confirm quality gate
npx tsc --noEmit             # expect: 0 errors
npx vitest run               # expect: 1533+ passed, 0 failed

# Confirm no uncommitted drift
git status                   # expect: clean working tree
```

Any non-zero result → **stop**, resolve, restart Phase 0.

---

## Phase 1 — Merge to main (10 min)

```bash
# Option A (recommended): one reviewed PR covering the whole branch
gh pr create --base main --head claude/wizardly-benz \
  --title "feat: ship Plans 1-5 + Lane 1 polish (156 commits)" \
  --body "See the 3-month-roadmap spec + per-plan runbooks."

# Review your own PR via the Vercel preview deploy. Make sure the preview
# render of /world, /marketplace, /agents/[slug] all work.

# Merge via squash or merge-commit. Let Vercel auto-deploy to production.
gh pr merge --merge --delete-branch=false
```

Wait for Vercel's production deploy to complete. Watch the build logs
for any missing env var warnings.

**Expected result:** `https://sovereignmatrix.agency` serves the new
landing. Dashboard accessible. No compile errors.

---

## Phase 2 — Database migrations (15 min)

Order matters — run in this sequence. Each in Neon Console SQL editor
as a **separate transaction**.

| # | File | Adds |
|---|---|---|
| 1 | `drizzle/0002_async_jobs.sql` | `jobs` table (from earlier session) |
| 2 | `drizzle/0003_playbook_runs.sql` | `playbook_runs` + `playbook_run_steps` |
| 3 | `drizzle/0018_credit_system.sql` | `user_credits`, `credit_transactions`, `credit_holds` |
| 4 | `drizzle/0019_safety_events.sql` | `safety_events` audit table |
| 5 | `drizzle/0020_sovereign_world.sql` | `agent_metadata`, `agent_installs`, `agent_reviews`, `agent_stats_daily` |
| 6 | `drizzle/0021_eval_runs.sql` | `eval_runs` + `eval_run_results` |
| 7 | `drizzle/0022_scheduled_playbooks.sql` | `scheduled_playbooks` |
| 8 | `drizzle/0023_playbook_run_scheduled_id.sql` | ALTER ADD COLUMN |

**Verification after each migration:**

```sql
-- confirm the table(s) created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%<keyword>%';
```

**If a migration fails:** do NOT continue. Restore from the Neon
point-in-time snapshot taken before you started, fix the issue, restart
from that migration.

---

## Phase 3 — Environment variables (15 min)

All set in **Vercel → Project → Settings → Environment Variables**,
scope "Production."

### Core (already set — verify present)

- `DATABASE_URL` — Neon pooled connection string
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- `NVIDIA_NIM_API_KEY`

### New env vars added across Plans 1-5 + L1 follow-ups

| Var | Used by | Get it from |
|---|---|---|
| `STRIPE_SECRET_KEY` | Revenue engine | Stripe → Developers → API keys (live) |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Stripe → Developers → Webhooks → (the endpoint) → Signing secret |
| `STRIPE_PRICE_STARTER` | Tier checkout | Stripe → Products → $19 plan → Pricing → API ID |
| `STRIPE_PRICE_GROWTH` | Tier checkout | Stripe → Products → $49 plan |
| `STRIPE_PRICE_NODE` | Tier checkout | Stripe → Products → $199 plan |
| `STRIPE_PRICE_ENTERPRISE` | Tier checkout | Stripe → Products → $499 plan |
| `CRON_SECRET` | Cron auth | `openssl rand -base64 32` — store in 1Password |
| `VOICE_SESSION_SECRET` | Voice token signing | `openssl rand -base64 32` — MUST match Railway |
| `NEXT_PUBLIC_VOICE_WS_URL` | Client voice WS | `wss://<railway-hostname>` (set after Phase 4) |
| `UPSTASH_REDIS_REST_URL` | SLO sample storage | Upstash → Redis DB → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | SLO sample auth | Upstash → Redis DB → REST token |
| `SENTRY_DSN` | Error tracking | Sentry → Project settings → Client keys |
| `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics (client) | PostHog → Project Settings → Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog instance URL | Typically `https://us.i.posthog.com` |
| `SLACK_WEBHOOK_URL` | SLO breach cron | Slack → Apps → Incoming Webhooks → Add to workspace |
| `ADMIN_USER_IDS` | Admin moderation panel | Clerk → Users → your user → copy `user_` ID |
| `RESEND_API_KEY` | Waitlist emails | Resend → API Keys |

### Optional (performance / fallback)

- `CEREBRAS_API_KEY` — second-fastest inference, free tier
- `VOICE_CHAT_MODEL` — override `nvidia/llama-3.1-nemotron-70b-instruct`
- `VOICE_TTS_MODEL` — override `nvidia/magpie-tts-flow`
- `VOICE_ASR_MODEL` — override `nvidia/parakeet-ctc-1.1b`
- `NIM_API_BASE` — override `https://integrate.api.nvidia.com/v1`
- `DATA_SOVEREIGNTY_MODE` — set to `"true"` to route only US/EU-weight models

After setting: redeploy production (Vercel → Deployments → Redeploy).

---

## Phase 4 — Railway deploy (voice WebSocket) (15 min)

The voice WS can't run on Vercel serverless (5-min function cap). Deploys
to Railway.

```bash
# From the repo root
railway login
railway init
# Pick: deploy a new project from this repo
# Framework: "Node" (not Next.js)
# Start command:  npx tsx server/voice-ws.ts

railway variables set VOICE_SESSION_SECRET=<same as Vercel>
railway variables set NVIDIA_NIM_API_KEY=<same as Vercel>
railway variables set DATABASE_URL=<same as Vercel>
railway variables set VOICE_WS_PORT=9090
railway variables set NIM_API_BASE=<same as Vercel, or default>

railway up --detach
```

Railway assigns a hostname like `voice-production-abc123.up.railway.app`.
Take that hostname and set `NEXT_PUBLIC_VOICE_WS_URL=wss://<hostname>` in
Vercel (Phase 3). Trigger another Vercel redeploy so the client picks it up.

**Verification:**
```bash
curl https://<railway-hostname>/     # expect: "ok"
```

---

## Phase 5 — Seed agent metadata (2 min)

With `DATABASE_URL` in your shell pointing at prod:

```bash
node scripts/seed-agent-metadata.mjs
```

**Expected output:**
```
Loading registry slugs…
Found 137 agents in registry.
Connecting to Postgres…
─── Seed complete ───────────────────
  Inserted:  137
  Skipped:   0 (already existed)
  Category breakdown:
    content         28
    leads           19
    ...
```

---

## Phase 6 — Vercel Deployment Protection (2 min)

Currently the production deploy is SSO-gated, blocking public access.

1. Vercel → Project → Settings → Deployment Protection
2. Change from **"All Deployments"** to **"Only Preview Deployments"**
3. Save.

Verify: open `https://sovereignmatrix.agency` in an incognito window
→ should load without auth prompt.

---

## Phase 7 — Cron verification (8 min)

Open **Vercel → Project → Cron Jobs** and verify all 11 entries:

| Path | Schedule |
|---|---|
| `/api/cron/job-runner` | `* * * * *` |
| `/api/cron/playbook-scheduler` | `*/5 * * * *` |
| `/api/cron/scheduler` | `* * * * *` |
| `/api/cron/weekly-report` | `0 8 * * 1` |
| `/api/cron/daily-digest` | `0 7 * * *` |
| `/api/cron/cleanup` | `0 3 * * 0` |
| `/api/health/ping` | `*/4 * * * *` |
| `/api/cron/sweep-expired-holds` | `* * * * *` |
| `/api/cron/dispatch-scheduled-playbooks` | `* * * * *` |
| `/api/cron/run-evals` | `0 */6 * * *` |
| `/api/cron/rollup-agent-stats` | `0 4 * * *` |
| `/api/cron/slo-weekly` | `0 9 * * 1` |

**Manually trigger each at least once** to confirm no auth/config errors:

```bash
curl -X POST https://sovereignmatrix.agency/api/cron/sweep-expired-holds \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
# Repeat for rollup-agent-stats, run-evals, slo-weekly
```

Expect: `{ ok: true, ... }` each time.

---

## Phase 8 — End-to-end smoke test (20 min)

The "would-a-new-user-have-a-good-first-day" check.

### A. Unauthenticated surface (5 min)

- [ ] `/` — landing renders, hero stats visible, CTAs clickable
- [ ] `/pricing` — 5 tiers visible, Stripe buttons go to checkout (no need to complete)
- [ ] `/marketplace` — catalog loads with 137 agents, featured row populated
- [ ] `/world` — constellation renders with 137 nodes
- [ ] `/agents/seo-dominator` — SEO page loads, JSON-LD visible in source
- [ ] `/leaderboard` — empty state ("No entries yet") since rollup hasn't run

### B. Signup + first run (8 min)

- [ ] Sign up with a fresh email → redirected to dashboard
- [ ] Run a free playbook (Lead Blitz) → completes successfully, writes a run to `playbook_runs`
- [ ] Check `/dashboard/analytics` — shows the run
- [ ] Top up $10 via Stripe (test card `4242 4242 4242 4242`) → credits appear

### C. Paid agent + creator payout (5 min)

This tests Plan 1 + L1.4 + L1.5 end-to-end.

- [ ] `/developers/submit` — create a test paid agent ($0.99/run), approve it via `/dashboard/admin/agents` as admin
- [ ] Create a second user, sign in as them, install the agent, run it
- [ ] Sign back in as the admin (creator) — verify credits = 0.8 × 0.99 appeared in the creator's balance

### D. Voice (5 min)

- [ ] `/dashboard/voice-assistant` → start session
- [ ] Click "Mic on" → grant permission → VAD triggers on first word
- [ ] Speak "hello" → verify `transcript` + agent voice reply
- [ ] Click "Interrupt" during playback → assistant cuts off within 500ms

If anything in A–D fails, triage before opening Week 1 to users.

---

## Phase 9 — Monitoring sanity (5 min)

- [ ] **Sentry** — trigger a test error via `?crash=true` on any page, verify event appears within 60s
- [ ] **PostHog** — trigger a CTA click, verify event appears in the live events feed
- [ ] **Upstash Redis** — after a few runs, check that keys like `slo:agent_latency_p95:2026-04-21` have members

---

## Phase 10 — Announce (2 min)

- [ ] Post in `#launch` Slack channel: "Production is live. Endpoint roster in this thread."
- [ ] Tweet (optional): "Built this for 6 months. Live now. [URL]"
- [ ] Update the founder program outreach template with the final URL.

---

## Rollback

If any phase after Phase 1 breaks production:

```bash
# Instant: revert via Vercel
# Vercel → Deployments → (last good prod deploy) → Promote to production

# Or via git (slower)
git revert <merge-commit-sha>
git push origin main
```

**Database rollback** (only for critical data-integrity issue) — Neon
PITR snapshot from before Phase 2. Coordinate with stripe-events + any
in-flight holds (releaseHold + Stripe refund as needed).

---

## Week 1 Day 2–7 — Observation schedule

Now the platform exists. The next 6 days is watch-and-respond:

| Day | Focus |
|---|---|
| Day 2 | Watch Sentry + PostHog for first user touches. Reply to every support ticket within 2h |
| Day 3 | First weekday traffic — Lighthouse the landing on a cold cache, set a baseline |
| Day 4 | First SLO dashboard check — `/dashboard/admin/eval-health` |
| Day 5 | First cost check — `/dashboard/admin/cost`. Confirm cost-per-run is under target |
| Day 6 | First manual rollup check — run `/api/cron/rollup-agent-stats` manually + verify `agent_stats_daily` rows populated |
| Day 7 | Week 1 retro. 3 questions: what shipped, what surprised us, what changes Week 2? |

---

## After Week 1

Move to the 3-month roadmap (`docs/superpowers/specs/2026-04-21-3-month-roadmap.md`)
starting with Week 2 — landing redesign.
