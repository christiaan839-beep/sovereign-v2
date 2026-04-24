# Operating model — how Sovereign Matrix stays elite

> This is the human side of the anti-drift machine. Automation is in
> `.github/workflows/` and `scripts/weekly-health.mjs`. This doc
> explains the cadence + rituals + definitions that bind the people
> to the machinery.

The problem this solves: **elite platforms decay silently**. Test coverage
drifts down. Docs go stale. Claims in marketing drift away from reality.
One hallucinated number in a pitch deck and the whole "code-verifiable"
moat evaporates.

The fix is not heroic vigilance. It's a small number of **mechanisms**
that run whether anyone remembers them or not.

---

## The 4 clocks

| Clock | Frequency | What triggers | Who responds |
|---|---|---|---|
| **Per-commit** | Every push to any branch | CI runs (tsc + lint + tests + build + reliability + E2E) | The author, before merge |
| **Per-PR** | Every pull request | Required status checks gate merge | Reviewer + author |
| **Weekly** | Monday 09:00 UTC | `weekly-health.yml` runs `scripts/weekly-health.mjs`, posts audit report as artifact | Whoever's on rotation; fix regressions within the week |
| **Quarterly** | Jan / Apr / Jul / Oct | Manual review of this doc, `STAY-ELITE.md`, `INDUSTRY-DOMINATION.md`, `WHATS-NOT-ELITE.md` against actual shipped work | Whole team |

---

## Per-commit: automated gates (CI)

`.github/workflows/ci.yml` runs on every push + every PR. The gate is:

1. **Lint & type check** — `npm run lint` + `npx tsc --noEmit` (strict; no `ignoreBuildErrors`)
2. **Build** — `npm run build` (catches dynamic-import + bundle issues)
3. **Tests** — `npm test` (all 2,300+ vitest tests must pass)
4. **Reliability tests** — dedicated job for the phase-1 hardening suite
5. **Security audit** — `npm audit --audit-level=high`
6. **E2E (Playwright)** — headless Chromium, runs `e2e/*.spec.ts` against a production build
7. **Docker build** — only on main pushes; proves the container still assembles

**If any of these fails, the commit is visibly broken.** No merging until green.

---

## Per-PR: the merge contract

Every PR must satisfy:

- ✅ All 7 CI jobs green
- ✅ Description answers: *"What gap does this close?"* (STAY-ELITE rule 2)
- ✅ If adding a feature: at least one test proving it works
- ✅ If touching the DB schema: a new numbered migration in `drizzle/`
- ✅ If changing a public API response: a changelog entry
- ✅ No new lint errors introduced (pre-existing ones are tracked separately)
- ✅ Reviewer has actually run the change locally or on preview

**Anti-patterns that block merge:**
- "Refactor" PRs that touch 40 files with no functional delta
- New features with no test
- Prompt changes without eval coverage for the affected agent
- Marketing-copy changes that touch `src/lib/claims/*` (those are code-verifiable claims — update the verification command too)

---

## Weekly: the anti-drift machine

**Monday 09:00 UTC**: `.github/workflows/weekly-health.yml` runs
`scripts/weekly-health.mjs`.

### What it measures

**Catalog** (counts)
- Agents in registry
- Agent route files on disk
- Unique LLM models referenced

**Marketing** (surfaces)
- Industry landing pages (≥10)
- Competitor `/vs` pages (≥10)

**Quality** (gates)
- `tsc --noEmit` clean
- Lint error count (drift ceiling)
- Tests passing (≥2,000)
- Eval coverage % (target climbs quarterly: 10→20→30→50)

**Infrastructure** (presence)
- SLO tracker (`src/lib/slo-tracker.ts`)
- Error codes (`src/lib/error-codes.ts`)
- OpenAPI endpoint (`src/app/api/openapi/route.ts`)
- `/status/slo`, `/compare`, `/playground`, `/docs/errors`, `/docs/webhooks/verify`
- E2E suite (`e2e/elite-surfaces.spec.ts`)

**Database**
- Migrations on disk (≥30)

**Process**
- `STAY-ELITE.md`, `WHATS-NOT-ELITE.md`, `MERGE-STRATEGY.md` all exist

### What to do with the report

1. **All green**: nothing. The machine is happy.
2. **Red**: within 7 days, either fix the regression OR update the target with a
   written rationale (never just raise the floor silently).
3. **Pattern over weeks**: if the same check keeps regressing, it's probably a
   process gap — e.g. "every time we add agents, eval coverage drops". Fix the
   process, not just the symptom.

---

## Quarterly: the honest review

Every 3 months, a ~1-hour session:

1. **Re-read `STAY-ELITE.md`**. Did the shipped work follow each rule? Which
   rule was violated most often? Why?
2. **Re-read `WHATS-NOT-ELITE.md`**. Which items closed? Which are still open?
   Any new gaps that deserve a row?
3. **Re-read `INDUSTRY-DOMINATION.md` milestones**. On track? Behind? Ahead?
4. **Re-run `scripts/weekly-health.mjs`** and compare quarter-over-quarter.
5. **Update targets** in `weekly-health.mjs` — things that should get harder
   over time (eval coverage 15→20→30%, test count floor, etc.).
6. **Kill dead docs**. Anything in `docs/` that's no longer true → delete or
   mark deprecated in the first line.

### Quarterly delivery commitments (from INDUSTRY-DOMINATION.md)

- **New agents**: ≥20 per quarter (1.5/week)
- **New industries** (full vertical pack): 1-2 per quarter
- **Eval coverage**: +5pp per quarter
- **New platform surface** (one major thing like /compare, /playground, /api/openapi): 1 per quarter

---

## Definition-of-done for a new agent

Before merging a new agent under `src/app/api/_agents/<slug>/`:

- [ ] Route file uses `createAgentRoute` or `createVisionAgentRoute` (not hand-rolled)
- [ ] Registered in `src/app/api/agents/registry.ts` (run `npm run gen:registry`)
- [ ] At least one eval in `src/lib/__tests__/agent-evals/golden-set.ts`
- [ ] Category + tagline + description fields set (feeds `/agents` directory)
- [ ] `category` matches one of the existing industries OR adds a new industry page
- [ ] Sitemap updated if adding a new URL surface
- [ ] Verified locally: `npx tsc --noEmit` clean, `npm test` green, `/playground?agent=<slug>` works

---

## Definition-of-done for a new landing page

- [ ] Lives at `src/app/<slug>/page.tsx` + `layout.tsx`
- [ ] `<h1>` uses `ed-display` + `ed-display-italic` (brand typography)
- [ ] No dynamic Tailwind classes (`bg-${color}-500` is silent breakage on v4)
- [ ] Added to `src/app/sitemap.ts`
- [ ] Mobile-responsive (verify at 375px)
- [ ] Contributes to / links to `/compare` for cross-surface navigation
- [ ] Has a unique structural feature (not identical section-shape as another page)

---

## Definition-of-done for a new public claim

Every number / stat / boast on a marketing surface MUST:

- [ ] Be code-verifiable via a shell one-liner
- [ ] Have that one-liner in a comment on the page OR referenced in a doc
- [ ] Be covered by `weekly-health.mjs` if it's a standing claim
- [ ] Round DOWN (5.2% coverage → "5% coverage"), never UP

---

## Who owns what

| Area | Owner (default) | Escalation |
|---|---|---|
| CI green on main | Last person to merge | Team lead |
| Weekly audit report | Rotation (define in repo issue) | Anyone who spots it red |
| `docs/STAY-ELITE.md` | Whole team | — |
| `docs/WHATS-NOT-ELITE.md` | Author of the claim that's not-yet-true | Quarterly review |
| Security-sensitive areas (auth, payments, webhooks) | Named person | CTO/founder |
| Platform status page | On-call | — |

---

## When things break (the incident flow)

1. **Detected**: usually via `/status/slo` going yellow or a user report.
2. **Declared**: post in `#incidents` (or equivalent) with: time, symptom, blast radius.
3. **Mitigated**: get back to green. Revert is always valid.
4. **Root-caused**: same day or next day. Write up: what, why, who-impacted.
5. **Fixed-forward**: landing a fix ships with a test that would've caught it.
6. **Post-mortem**: within 7 days. 1-2 pages. Lessons feed into this doc,
   STAY-ELITE.md, and/or weekly-health.mjs.

Blameless. The point is making sure the same class of bug can't recur.

---

## The single rule that shapes everything else

> If you can't measure it weekly, you can't claim you have it.

Every elite-tier attribute we claim (218 agents, 46 models, 7 safety
layers, 10 industries, crypto signing, graceful degradation, SLO
tracking) has a corresponding check in `scripts/weekly-health.mjs`.

New claims need new checks. Old claims that can't be measured anymore
get retired from the marketing surfaces. This is the mechanical
enforcement of STAY-ELITE rule 1.

> Fewer + sharper over more + softer. (STAY-ELITE §129)
