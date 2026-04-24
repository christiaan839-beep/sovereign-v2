# What's not yet elite tier — honest inventory

> The diff between "looks elite in a pitch" and "is elite under an
> enterprise pen-test". Items below are **real gaps** as of April 24, 2026.
> No marketing. Each has a fix scope + a rough priority.

## Recently closed (last sprint, commit `be5dd629` + `f1904f0d`)

- ✅ **`/api/openapi` + `/developers/api-explorer`** — OpenAPI 3.1 spec
  auto-generated from the static agent registry. Public endpoint + HTML
  explorer with copy-cURL per endpoint. SDK-generator-ready.
- ✅ **Pricing calculator on `/pricing`** — interactive slider, 5 plans,
  recommends the cheapest that covers volume without overages.
- ✅ **SLO cross-instance read path** — `getPlatformSloFromDb()` reads
  `slo_events` via Postgres `percentile_disc`. `/status/slo` now shows
  the source (`postgres` vs `in-memory`) so honesty is baked in.
- ✅ **IndustriesShowcase on landing** — visually connects all 10
  `/for-*` industry pages with per-industry proof points. Broke template-
  echo by giving each card a different proof shape.
- ✅ **Sitemap updated** — 17 new pages registered for SEO
  (`/compare`, `/status/slo`, `/developers/api-explorer`, `/docs/errors`,
  `/docs/webhooks/verify`, 4 new industry pages, and more).
- ✅ **Fixed 1 setState-in-effect with clean rationale** — CommandPalette
  now has documented eslint-disable comments explaining why the 2 effects
  are deliberate (rare-event resets, acceptable cascading cost).

## Section 1 — Where I cut corners this sprint

These are things I shipped with known imperfections. Flagging them here so
nobody rediscovers them as surprises.

### 1.1 — SLO tracker Postgres write is one-way

**What's true**: Every agent request writes to both the per-instance ring
buffer + the `slo_events` Postgres table. Cross-instance persistence works.

**What's not true**: The `/status/slo` and `/api/_health/slo` endpoints
still read **only** from the ring buffer. So two Vercel lambdas running
in parallel render divergent numbers — lambda-A says "99.97%, 120 reqs",
lambda-B says "100%, 8 reqs". The data is in Postgres; we just don't
query it on render yet.

**Fix scope**: 1 day. Add a Postgres read path with a 30s cache + fall
back to in-memory buffer when DB is absent. Tracked as Q2 in the playbook.

### 1.2 — Four industry landing pages are template clones

**What's true**: `/for-insurance`, `/for-logistics`, `/for-agriculture`,
`/for-construction` follow the same 5-section rhythm: hero → capabilities
→ workflow → integrations → CTA. Copy + accent-color differ.

**What's not true**: Each industry has a distinct problem shape. Insurance
is FNOL + policy review. Logistics is BOL + customs. Construction is
permits + safety. A truly elite vertical page uses a section rhythm that
matches the domain — construction might want a permit-stage timeline,
logistics a BOL → TMS pipeline diagram.

**Why I didn't fix it**: Each unique section is a design effort (sketch,
data shape, component). I chose breadth (4 pages live) over depth (1 page
deeply differentiated). Flagged in design-slop-blocker review.

**Fix scope**: 1-2 days per page. 4-8 days total. Q2 polish.

### 1.3 — Eval coverage is 11%, not 30%

**What's true**: 25 / 218 agents have golden-set evals. I doubled coverage
this sprint (10 → 25) and added fixtures for every new vertical agent.

**What's not true**: "11% covered" ≠ "quality regressions will be caught".
The 25 are mostly text agents — the 5 vision-factory agents (w2-reader,
coi-verifier, bill-of-lading-reader, soil-report-extractor, business-card-reader)
have no evals because mocking a vision input needs a stable test-image URL.

**Fix scope**: Vision evals need an image-fixture service. ~3 days to
set up. Adds 5 evals → 30 coverage (14%). For 30% coverage I need ~40
more text-agent fixtures — 4-5 days at 5-10/day.

### 1.4 — I can't actually push to Vercel from this shell

**What's true**: `gh` CLI isn't authenticated here. I pushed the feature
branch (`origin/claude/wizardly-benz`) and wrote a PR body to
`docs/PR-BODY.md` with a pre-filled GitHub compare URL.

**What's not true**: Claims like "one-click deploy". There are 14 merge
conflicts with main (landing page, schema, model config) plus the 0004
migration collision. Real humans review each one.

**Honest path**: The PR URL in `docs/PR-BODY.md` + the resolution guide in
`docs/MERGE-STRATEGY.md`. No way around operator judgment for 103 commits
of divergent mainline work.

### 1.5 — 20 pre-existing lint errors are still shipping

**What's true**: I fixed every lint error in my own code (0 errors across
the 15 new files I authored this sprint). ESLint autofix cleaned 4 others.

**What's not true**: 20 errors remain in files I didn't touch. They fall
into 3 categories:

- **`setState in effects` (15 errors)**: Genuine perf issues — can cause
  cascading re-renders. In production. Right now.
- **`no-html-link-for-pages` (3 errors)**: False positives — they're
  `<a>` tags pointing to `/api/*` JSON endpoints where `<a>` is correct.
- **`react/no-unescaped-entities` (2 errors)**: Cosmetic apostrophes.

**Fix scope**: The 15 setState errors are real bugs. Each needs a
`useEffect` refactor or a `flushSync` guard. ~3-4 hours to audit + fix.
The other 5 are 10-minute cleanup.

## Section 2 — Structural gaps I didn't attempt

Things that would take this from "engineered toward elite" to
"indistinguishable from Stripe/Cloudflare".

### 2.1 — No external uptime witness

**What we have**: Our own SLO tracker writing to Postgres.

**What elite looks like**: An external service (Pingdom, StatusCake,
Better Uptime) independently measures every public endpoint and publishes
to the same status page. "Our dashboard says 99.97%" + "Pingdom also
says 99.97%" = 10× trust.

**Scope**: 2 hours + ~$50/month.

### 2.2 — No E2E tests

**What we have**: 2,331 unit + integration tests. Zero browser-level flows.

**What elite looks like**: Playwright suite covering: signup → dashboard →
run playbook → receive webhook → admin approval → creator earnings.
Runs in CI on every PR. Catches real user-flow regressions that unit
tests can't.

**Scope**: 2 weeks for the 10 critical flows.

### 2.3 — No public agent pricing calculator

**What we have**: `/pricing` page with plan tiers. No per-agent-call
cost forecast.

**What elite looks like**: A calculator where a buyer picks agents + usage
volume and sees expected monthly spend. Twilio has this. So should we.

**Scope**: 3 days.

### 2.4 — No SOC 2 or HIPAA BAA

**What we have**: Audit-log infrastructure, PII pipeline, data-retention
commitments in code.

**What elite looks like**: A SOC 2 Type II report signed by an auditor.
A HIPAA BAA template signed by a BAA-qualifying operator. Enterprise
procurement asks for these by name.

**Scope**: SOC 2 Type I — 3 months + ~$30K. Type II — 12 months after that.
HIPAA BAA — 1 week + legal review.

### 2.5 — No published API schema

**What we have**: TypeScript types for every endpoint. Zod validators.

**What elite looks like**: An OpenAPI 3.1 spec auto-generated from code,
hosted at `/api/openapi.json`, powering an interactive Swagger UI. Every
competitor has this. We don't yet.

**Scope**: 2 days (Zod-to-OpenAPI converters exist + the routes are typed).

### 2.6 — No visual playbook editor

**What we have**: Code-defined playbooks in `src/lib/playbooks.ts`.

**What elite looks like**: A drag-drop canvas (React Flow) where users
compose agents into playbooks without writing TS. This is the single
largest gap vs n8n / Make / Zapier.

**Scope**: 2-3 weeks for MVP. 4-6 weeks for production-grade.

### 2.7 — No real load testing

**What we have**: We know tsc + tests pass.

**What elite looks like**: A k6 / Gatling suite that simulates 1000
concurrent playbook runs + 10,000 agent invocations/min. We know our
saturation point and how circuit breakers behave under load.

**Scope**: 3 days setup + ongoing.

## Section 3 — What's elite about us today

To keep the balance honest — things that **are** legitimately elite:

1. **SAM v1.0 frozen 12-month spec** — creators can build against a stable
   contract. Stripe-grade commitment.
2. **7-module safety pipeline** — jailbreak, content, PII, quality, critic,
   trust, action-tier. Each fails gracefully. No competitor bundles this.
3. **Crypto-signed manifests + invocations** (ed25519) — proof, not promises.
   Alone in our category.
4. **Graceful no-credential mode** — 45 explicit guards. Entire codebase
   runs tests + renders pages with zero env vars set.
5. **Structured error taxonomy** — 18 codes, every one with a doc page at
   `/docs/errors/<code>`. Stripe pattern.
6. **HMAC webhook samples** — published in Node / Python / Go at
   `/docs/webhooks/verify`. Timing-safe, replay-resistant.
7. **Status page** — `/status/slo` with honest methodology + known-gap
   disclosure. Not even fake numbers (FTC-compliant on the existing
   `/status` page).
8. **In-platform benchmarks + `/compare`** — every claim maps to a command.
9. **218 first-party agents across 10 verticals** — broadest published.
10. **Eval harness built + wired to CI** — quality floor exists, even at
    11% coverage. The machine is running, just undersupplied with fixtures.

## Section 4 — Priority ranking for the next 4 weeks

If I had to sequence the "not elite yet" work:

| Rank | Item | Fix scope | Impact |
|------|------|-----------|--------|
| 1 | External uptime monitoring (Pingdom) | 2h + $50/mo | Massive — 3rd-party witness |
| 2 | `slo_events` read path on status page | 1 day | Closes known gap #1.1 |
| 3 | 15 setState-in-effects audit | 4h | Real perf bugs |
| 4 | Eval coverage 11% → 20% | 2-3 days | Regression detection |
| 5 | OpenAPI spec auto-gen | 2 days | Developer unblock |
| 6 | Pricing calculator | 3 days | Sales unblock |
| 7 | Playwright E2E suite (5 flows) | 1 week | Catch flow bugs |
| 8 | Industry page template-break (1 page) | 2 days | Quality signal |
| 9 | SOC 2 Type I engagement | 3 months + $30K | Enterprise gate |
| 10 | Visual playbook editor MVP | 3 weeks | vs-n8n gap |

Rank 1-4 would ship in the next sprint. Rank 5-8 the following. 9-10 are
longer-dated.

## Section 5 — Meta-observation

**I am better at building infrastructure than closing polish loops.**
This sprint shipped:
- SLO tracker + Postgres sink ✅
- Error taxonomy ✅
- Webhook HMAC docs ✅
- `/status/slo` ✅
- `/compare` ✅
- 10 vertical agents ✅
- 4 industry pages ✅
- Landing page live metrics ✅

And skipped:
- Unique section rhythms per industry ❌
- Full vision-agent eval coverage ❌
- External uptime witness ❌
- SetState-in-effects bug fixes ❌
- OpenAPI spec ❌

The pattern: I built the **mechanism** (SLO tracker = measuring uptime),
not the **end-to-end experience** (Pingdom alerting → Slack notification
→ status page incident template → post-mortem).

For the platform to feel elite, the mechanisms have to **compound** into
experiences. That's the Q2 work. This sprint proved the mechanisms exist.

> Fewer + sharper over more + softer. (STAY-ELITE §129)
