# Sovereign World — Deployment Runbook (Plan 2)

**Branch:** `claude/wizardly-benz`
**Plan:** `docs/superpowers/plans/2026-04-21-sovereign-world.md`
**Commits:** 14 (from `784aa843` plan 2.1 → `82ff0d12` plan 2.14)
**Tests:** 1405/1405 passing (+64 since Plan 1/4/5 — 1341 → 1405)
**TypeScript:** 0 errors
**Lint:** 0 errors on new files
**Human deploy time:** ~25 minutes (migration + seed + smoke tests)

---

## What Shipped

### Database (Task 1 — migration `0020`)

Four new tables:

| Table | Purpose |
|---|---|
| `agent_metadata` | Display name, category, pricing, tags, featured/verified flags. **Slug is PK** (couples DB to the code registry) |
| `agent_installs` | Per-user agent installs. Unique index on (user_id, agent_slug) → idempotent installs |
| `agent_reviews` | One review per user per agent (unique index). Rating 1-5, comment ≤2000 chars |
| `agent_stats_daily` | Composite PK (agent_slug, day). Rolled up nightly from `agent_activity` + `playbook_run_steps` |

Plus: RLS policies, `updated_at` triggers, indexes for the leaderboard query paths.

### Service Module (Task 3)

`src/lib/agent-catalog.ts` — single read API for /world, /marketplace, /agents/[slug], /leaderboard.

- `listCatalog({ category?, limit? })` — one query with `leftJoin + groupBy` to avoid N+1 on 137 agents.
- `getAgentPublic(slug)` — 3 parallel queries (metadata / reviews agg / stats agg). Null when slug not in `AGENT_REGISTRY`. Humanizes slug → displayName when metadata row missing (safe fallback when seed hasn't run).
- `PublicAgent` interface — the public contract. No creator user IDs, no internal routing.

### API Routes (Tasks 4-8)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog` | List all agents + category counts. 60s edge cache |
| GET | `/api/catalog/[slug]` | Single agent detail. 30s browser / 60s edge on hits, `no-store` on misses |
| POST | `/api/catalog/[slug]/install` | Idempotent install. 402 on paid + insufficient credits |
| DELETE | `/api/catalog/[slug]/install` | Uninstall. Always 200 |
| GET | `/api/catalog/[slug]/reviews` | Public, newest 20 |
| POST | `/api/catalog/[slug]/reviews` | Clerk-required. Zod-validated upsert (one per user) |
| GET | `/api/leaderboard` | Top-50 by `sort ∈ {success,cost,speed,earnings}` × `window ∈ {7d,30d,all}` |
| POST | `/api/developers/submit` | 3rd-party agent submission (unlisted + pending review) |

### Cron (Task 9)

`/api/cron/rollup-agent-stats` — **4 AM UTC daily**. Two-phase rollup:
1. Counts from `agent_activity` (runs, successes, unique_users) filtered to `action IN ('completed','failed')`.
2. Durations from `playbook_run_steps` (avg `duration_ms`) where `status IN ('done','failed')`.

Both use `ON CONFLICT (agent_slug, day) DO UPDATE` — idempotent, safe to re-run.

### UI Pages (Tasks 10-14)

| Path | Type | Purpose |
|---|---|---|
| `/world` | Client | Full-screen interactive constellation of 137 agents, clustered by category. Click → drawer |
| `/marketplace` | Client | Upgraded to live catalog — featured row + filter pills + grid |
| `/agents/[slug]` | **Server** | SEO-optimized detail page with generateMetadata() + JSON-LD layout |
| `/leaderboard` | Client | Sortable table, 4 metrics × 3 windows |
| `/developers/submit` | Client | 3-step wizard (Define → Configure → Submit) |

### Shared Components

```
src/components/world/
├── AgentDrawer.tsx       — right-side slide-in (fetches on open)
├── Constellation.tsx     — Canvas 2D render loop with hit-test
├── FilterRail.tsx        — left-rail search + category list
├── AgentCard.tsx         — shared card (default + featured variants)
└── LeaderboardTable.tsx  — sortable rank table with medals
```

---

## Deployment Order

### Step 1 — DB Migration (5 min)

Open the Neon Console → SQL Editor → paste the contents of `drizzle/0020_sovereign_world.sql` → Run.

Verify:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('agent_metadata','agent_installs','agent_reviews','agent_stats_daily');
-- Expect 4 rows
```

### Step 2 — Seed Default Metadata (2 min)

Locally (or from a safe shell with `DATABASE_URL` set):

```bash
node scripts/seed-agent-metadata.mjs
```

Expected output:
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
    intelligence    15
    ...
```

Re-running is safe — `ON CONFLICT (slug) DO NOTHING` means no admin hand-edits are overwritten.

### Step 3 — Deploy Code (8 min)

Merge `claude/wizardly-benz` to `main`. Vercel auto-deploys from GitHub.

Watch the deployment for:
- ✅ All 14 new routes building
- ✅ `vercel.json` picks up the new `/api/cron/rollup-agent-stats` entry (schedule `0 4 * * *`)

### Step 4 — Smoke Tests (5 min)

```bash
# Public catalog — should return 137 agents + counts
curl https://sovereignmatrix.agency/api/catalog | jq '.total, .counts'

# Single detail
curl https://sovereignmatrix.agency/api/catalog/seo-dominator | jq '.agent.displayName'

# Leaderboard (will be sparse until rollup runs — expect 0 entries initially)
curl "https://sovereignmatrix.agency/api/leaderboard?sort=success&window=30d" | jq '.entries | length'
```

Browser checks:
- `/world` — constellation renders, 137 dots, hover tooltip appears, click opens drawer
- `/marketplace` — featured row at top, category filter works, counts next to each pill
- `/agents/seo-dominator` — view source shows `<script type="application/ld+json">` with SoftwareApplication schema
- `/leaderboard` — empty state shows "No entries yet" (expected until Step 5)
- `/developers/submit` — wizard loads; without Clerk login, step 3 submission redirects to `/signup`

### Step 5 — Trigger First Rollup (2 min)

The cron fires at 04:00 UTC. To avoid waiting overnight, trigger manually:

```bash
curl -X POST https://sovereignmatrix.agency/api/cron/rollup-agent-stats \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
# { "ok": true, "countsAffected": 0, "durationsAffected": 0, "rolledUpDay": "2026-04-20" }
```

(Zero-affected on a fresh deploy is correct — nothing has run yet.)

### Step 6 — Verify Leaderboard Populates (after usage)

Once any agent runs once, the **next** 4 AM UTC rollup will write `agent_stats_daily` rows and the leaderboard starts rendering entries. No further action required.

---

## Environment Variables

**No new env vars.** Plan 2 reuses:

| Var | Used by |
|---|---|
| `DATABASE_URL` | All DB reads/writes |
| `CRON_SECRET` | `/api/cron/rollup-agent-stats` auth |
| `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` | Install/review/submit endpoints |

---

## What's NOT Built Yet (Known Follow-ups)

### Admin moderation panel
Submissions land as `visibility='unlisted'`. Promoting them to `'public'` requires a DB UPDATE or an admin dashboard page that isn't built yet. **Short-term workaround:** Neon Console SQL.
```sql
UPDATE agent_metadata
SET visibility='public', verified=true
WHERE slug = '...submitted-slug...';
```

### Hosted-endpoint runtime
The submission wizard accepts hosted-endpoint URLs but we don't proxy requests to them yet. Needs a new route that signs outgoing requests and validates responses.

### Cost tracking on stats
`agent_stats_daily.total_cost_cents` stays at 0 until `credit_transactions` learns to tag rows with an `agent_slug`. Not blocking — the leaderboard's "earnings" and "cost" sorts just return 0 for everything until this lands.

### Creator payout ledger (80% revenue split)
Wizard promises 80% of per-run pricing to the creator. The math is correct on the UI but the actual split transaction (agent runs → creator credit entry) is in Plan 1's follow-up queue.

---

## Quality Gate Summary

| Metric | Value |
|---|---|
| Plan 2 commits | 14 |
| Tests added | +64 (1341 → 1405) |
| TypeScript errors | 0 |
| Lint errors on new files | 0 |
| New migrations | 1 (0020) |
| New cron schedules | 1 (`rollup-agent-stats`) |
| New API endpoints | 8 |
| New pages | 4 (`/world`, `/agents/[slug]`, `/leaderboard`, `/developers/submit`) |
| Marketplace upgraded | Yes (now live-catalog-backed) |
| New shared components | 5 (`src/components/world/*.tsx`) |

---

## Rollback

If the constellation page or any /api/catalog* route misbehaves:

1. **Code rollback**: `git revert <merge-commit>` + redeploy. Zero data loss — all 4 tables are additive.
2. **Keep DB tables**: no need to drop the 4 new tables on rollback. They're empty until someone exercises them.
3. **Cron**: Vercel cron entry will throw on missing route — harmless, retry next tick.

---

## Next

With Plans 1, 2, 4, 5 shipped, **Plan 3 (Voice Agent)** is the last remaining one from the original decomposition:
- `docs/superpowers/plans/2026-04-21-voice-agent.md`
- 9 tasks, ~15-20 hours
- Real-time WebSocket voice loop with VAD, personas, barge-in
- Spec documents the likely Railway (not Vercel) deployment for the WebSocket route
