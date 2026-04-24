# Gap-closing session — April 24, 2026

> Session retrospective. What shipped, what needs the operator's keys,
> and what drift flags are worth watching.

## What shipped in this session (code-complete)

### Gap #6 — Ops tooling

| Artifact                              | Purpose                                           |
|---------------------------------------|---------------------------------------------------|
| `scripts/apply-migrations.mjs`        | Idempotent SQL applier with drift detection      |
| `docs/MERGE-STRATEGY.md`              | 353-commit merge playbook + 0004 collision notes |
| `package.json` scripts                | `npm run db:apply` and `db:apply:dry` aliases    |

**Verified**: `--help`, missing-DATABASE_URL failure, and `--dry-run` mode all
exercise without touching a DB. `@neondatabase/serverless` Client pattern
(not `neon()`) — supports multi-statement tx per migration file.

### Gap #8 — Unified creator home

- `src/app/dashboard/creator/page.tsx` — server-rendered earnings + agents
  + quick actions under Clerk gate.
- Parallel fetch of `summarizeForCreator(email)` + agent list.
- Status badges color-coded: verified (copper), pending (neutral), rejected (ink).

### Gap #9 — Five vertical-depth vision agents

All built on `createVisionAgentRoute` factory. Each ships a zod `outputSchema`,
vertical-specific system prompt, and graceful no-key degradation.

| Slug                     | Category   | Key invariant                                   |
|--------------------------|------------|-------------------------------------------------|
| `w2-reader`              | Finance    | SSN masked to `XXX-XX-NNNN`; amounts in cents   |
| `id-verifier`            | Compliance | Last 4 of doc#; MRZ presence only, never content |
| `business-card-reader`   | Sales      | Email lowercase, phone E.164, @ stripped        |
| `menu-digitizer`         | Ecommerce  | Section order preserved; prices in cents        |
| `blueprint-parser`       | Real Estate| Room enum; half-baths allowed; disclaimer built-in|

Registry: 203 → **208** entries. Alphabetical invariant preserved.

### Gap #11 — Admin bundle curator

- `src/app/admin/bundles/page.tsx` — `isAdmin()` + `notFound()` gate pattern.
- `src/app/admin/bundles/BundleCuratorClient.tsx` — client island with live
  share-sum validation (must equal 100) and dynamic members editor.
- `src/app/api/admin/bundles/route.ts` — `GET` list + `POST` create via
  `createBundle()` from `agent-bundles.ts`. Structured error codes
  (`slug_required`, `agent_not_found`, `slug_taken`).
- `src/app/api/admin/bundles/[id]/publish/route.ts` — `POST` flips
  `is_public = true` idempotently via `COALESCE` on `publishedAt`.

### Gap #12 — Webhook subscription management

- `src/app/api/webhooks/subscriptions/route.ts` — `GET` caller's subs +
  `POST` create with HMAC secret returned **once** in the response.
- `src/app/api/webhooks/subscriptions/[id]/route.ts` — `DELETE` soft-delete
  (`is_active = false`) scoped to caller's email. 404 for both
  "not found" and "not yours" to avoid existence leak.
- `src/app/dashboard/webhooks/page.tsx` + `WebhooksClient.tsx` — list +
  create + delete UI with one-shot secret reveal (copy-to-clipboard,
  2s auto-dismiss).
- HTTPS-only callback URL validation — HTTP would send HMAC in cleartext.

### Gap #E7 — Public submission status page

- `src/app/creators/status/[refId]/page.tsx` — no-auth, reference ID is
  the capability token. Shows minimum info (status + reason + timestamps).
- `robots: { index: false, follow: false }` — shareable-by-link, not
  crawlable. Does NOT expose manifest, email, or safety scores.

---

## Verification state

| Check                               | Result            |
|-------------------------------------|-------------------|
| `npx tsc --noEmit`                  | clean (0 errors)  |
| `npx vitest run`                    | 2316/2316 passed  |
| Registry count                      | 208 entries        |
| `node scripts/apply-migrations.mjs --help` | prints usage |
| Missing-DATABASE_URL failure mode   | exits 1 with clear msg |

---

## What requires the operator's keys

These can be shipped to `main` now, but won't go live in prod without
external credentials I don't have:

- [ ] **Land PR**: the 353-commit merge to `main` — see
      `docs/MERGE-STRATEGY.md` for the exact path.
- [ ] **Apply migrations on prod**: `DATABASE_URL="$PROD" npm run db:apply`.
      Includes `0002_async_jobs`, `0003_playbook_runs`,
      `0025_sam_submission_fields`, `0028_creator_earnings`,
      `0030_agent_bundles`, `0031_webhook_subscriptions`.
- [ ] **Set Vercel env vars**: ensure every key from `.env.example` is
      present in Vercel Settings → Environment Variables.
- [ ] **Disable Vercel Deployment Protection for prod** (Vercel Dashboard
      → Settings → Deployment Protection → "Only Preview Deployments").
- [ ] **Stripe Connect onboarding**: required for creator earnings payouts;
      set up at stripe.com/connect.
- [ ] **npm publish** the SAM validator package (blocked behind creator
      experience polish).

---

## Drift flags

Watch for these next `/loop` around:

1. **Migration 0004 collision** — `origin/main` has `0004_remaining_tables.sql`;
   feature branch has `0004_stripe_events.sql`. Both will end up on merged
   `main`. See `docs/MERGE-STRATEGY.md` §3.
2. **Drizzle journal drift** — `drizzle/meta/_journal.json` tracks only
   0000 + 0001. Every subsequent migration bypasses drizzle-kit, which is
   why `scripts/apply-migrations.mjs` is the only honest applier.
3. **Eval coverage** — `10/208 agents have an eval (5%)`. The `evals.test.ts`
   report is now the canonical gap signal. A session focused on evals
   would close the single largest remaining quality-gate deficit.
4. **Registry drift** — new agents under `src/app/api/_agents/*` MUST be
   added to `src/app/api/agents/registry.ts` or they won't bundle on
   Vercel. `scripts/generate-agent-registry.mjs` regenerates it.

---

## How this session stayed elite

| STAY-ELITE rule                                | Followed because…                                                 |
|------------------------------------------------|-------------------------------------------------------------------|
| Rule 1 — Every claim is code-verifiable        | "208 agents" maps to `grep -c "() => import" src/app/api/agents/registry.ts` |
| Rule 2 — Features must have a gap they close   | Each gap is listed explicitly above                                |
| Rule 3 — DB schema is the source of truth      | Every new feature backed by a column — webhook_subscriptions, agent_bundles, creator_earnings tables |
| Rule 4 — Graceful degradation                  | `databaseIsConfigured()` early returns in every new API route      |
| Rule 5 — One honest release note per ship      | This doc **is** that release note                                   |

> Fewer + sharper over more + softer.
