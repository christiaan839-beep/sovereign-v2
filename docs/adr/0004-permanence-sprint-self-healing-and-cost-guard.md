# ADR-0004: Permanence Sprint — self-healing telemetry, cost-runaway guard, and the constitution

**Status:** Accepted (2026-04-28)
**Date:** 2026-04-28
**Deciders:** @christiaandewet
**Affects:** `docs/PROJECT-CONSTITUTION.md`, `docs/SUCCESSION.md`,
`src/lib/cost-runaway.ts`, `src/lib/cost-cap-alert.ts`,
`src/app/api/cron/self-heal/route.ts`, `drizzle/0042_*.sql`,
`scripts/generate-changelog.mjs`, `scripts/dep-rot-detector.mjs`

## Context

The platform has shipped 26 prior sprints' worth of features, security
hardening, and quality work. The Round 26 sprint (April 24-25) closed
the durability gap: HITL queue, audit log, usage counters all moved to
DB-first. The Round 27 question is different — *not what new feature
to build, but what infrastructure does the platform need to OUTLIVE
its current maintainer?*

Two failure modes were identified as out-of-band-fixable today but
catastrophic if left:

1. **Architectural drift over time.** The anti-drift gate (141
   invariants in `weekly-health.mjs`) runs in CI on every PR. But:
   force-pushes, bypassed CI, direct prod env-var changes all let
   drift accumulate silently. A regression that lands on Tuesday
   may not be detected until the next CI run — which could be a
   week later if no PRs land in between. Worst case: weeks of
   silent rot before a customer notices.

2. **Financial death by runaway agent.** A single misconfigured
   agent, an A2E loop that recurses 50 levels deep, an attacker
   holding a stolen API key — without a per-tenant ceiling, the
   platform's worst plausible failure is bankruptcy. Stripe
   notifies the operator AFTER the charge; the platform should
   stop the bleeding BEFORE it.

A third-tier failure mode — bus factor of 1 — was also addressed via
the Project Constitution + Succession Plan (non-code artifacts).

### Constraints

- **No new external dependencies.** Each new dep is a future CVE,
  a future supply-chain risk, a future maintenance burden. Solutions
  must use what's already in the tree (Postgres, Vercel Cron, Sentry).
- **Fail-open for hot-path code.** Anything in the request path must
  not break the platform on its own DB blip. Cost cap, telemetry,
  audit log writes — all must `try/catch` and continue.
- **Self-healing without manual intervention.** Once shipped, an
  operator should not need to touch these for them to keep working.
  The only exception is the user-contributed alert dispatch in
  `cost-cap-alert.ts`, which is intentionally opt-in.

### Options considered

#### Option A — Defer; rely on CI alone for drift, on Stripe for cost

What it is: do nothing this sprint. Trust the existing CI on every
PR, trust Stripe billing alerts to catch overspend.

- **Pro:** zero work, zero new code paths.
- **Con:** silent drift between CI runs is the documented failure
  mode. Stripe notifies AFTER the charge, not before.
- **Con:** customer-trust artifact ("we've been at 141/141 for 90
  days") doesn't exist; impossible to surface in a sales
  conversation.

#### Option B — Per-route cost guards (chosen)

What it is: a per-tenant per-day ledger updated atomically on every
agent run. When the cumulative day-spend crosses the plan-aware cap,
the tenant auto-pauses (402 returned to subsequent calls). Auto-unpause
at next UTC midnight via natural day-bucket key.

- **Pro:** O(1) cost-cap check per request via primary-key lookup.
- **Pro:** Per-plan caps mean the free tier ($50/day) and enterprise
  ($2000/day) get appropriate ceilings.
- **Pro:** Auto-unpause is implicit (no cron needed) — the next day
  is just a different ledger row.
- **Con:** atomic upsert on `(user_id, day)` requires a unique
  index. Mitigated by a single migration.
- **Con:** the "cost in cents per run" estimate is rough (1 cent/run).
  Mitigated: the cap exists to catch abuse (1000s of runs/day), not
  to bill correctly.

#### Option C — External rate-limit-as-cost-cap (rejected)

What it is: rely on Upstash Redis to enforce cost caps via a
pre-configured "credits per day" key.

- **Con:** the cap is in the same SoS as rate limits — a Redis
  outage breaks both. The DB-first ledger survives Redis outages.
- **Con:** Redis can't natively enforce per-plan cap variation
  without a Lua script; complexity moves into Redis-config.

#### Option D — Hourly anti-drift telemetry (chosen)

What it is: a Vercel cron that runs `scripts/weekly-health.mjs`
every hour and persists each result to `platform_health_snapshots`.
Operator gets paged via Sentry on any regression. Admin dashboard
graphs invariants-over-time.

- **Pro:** drift detected within ~1 hour, not weeks.
- **Pro:** persisted history is the trust artifact ("141/141 for
  90 consecutive days") for procurement teams.
- **Con:** spawning a child process inside a Vercel function is
  fragile if the function filesystem doesn't include
  `scripts/weekly-health.mjs`. Mitigated: the cron returns
  `{skipped: true}` cleanly when the script is unavailable, and
  the CI gate on every PR is the primary defence regardless.

## Decision

Ship all of B + D + the Constitution + Succession Plan + auto-CHANGELOG
+ dep-rot detector + ADR scaffolding as a single bundle. Each piece is
independently shippable; together they form the project's permanence layer.

## Consequences

### Positive

- **Regressions detected within 1 hour, not weeks.**
- **Cost-cap-induced bankruptcy moved from a real risk to a
  bounded one.**
- **The Constitution makes "why did we do X?" answerable from a
  document, not from the original maintainer's memory.**
- **The Succession Plan means a new maintainer can take over in
  hours, not weeks.**
- **The ADR template + the auto-CHANGELOG + the dep-rot detector
  ensure the project's *meta-state* (decisions, history,
  dependencies) stays as healthy as the *code-state*.**

### Negative

- **More moving parts.** A self-heal cron, a cost ledger, a CHANGELOG
  generator, a dep-rot detector — each is one more thing that can fail.
- **The cost-cap default ($50/day for free tier) might block
  legitimate power-users on free.** Mitigated: the operator can
  bump per-tenant via direct SQL on the ledger.
- **The self-heal cron doesn't run reliably on every Vercel deploy
  shape** (depends on whether `scripts/weekly-health.mjs` is in the
  function's filesystem). Mitigated: it returns "skipped" cleanly
  in that case, and CI on every PR remains the primary gate.

### Mitigations

- All four artifacts have unit tests + anti-drift invariants —
  removing any one of them fails CI.
- The cost guard fails OPEN on DB error: a Postgres blip never
  breaks the platform, only delays cost enforcement until the
  next request.
- The Constitution explicitly forbids removing the anti-drift
  gate without a Constitutional ADR.

## Implementation

- `drizzle/0042_platform_health_and_cost_runaway.sql` — two new
  tables: `platform_health_snapshots`, `tenant_cost_ledger`.
- `src/db/schema.ts` — Drizzle definitions for both.
- `src/lib/cost-runaway.ts` — pure-function evaluator + atomic
  upsert.
- `src/lib/cost-cap-alert.ts` — alert dispatch (audit log + log;
  the user-contribution point for email/Slack/PagerDuty).
- `src/lib/agent-factory.ts` — wire the pre-check (402) and the
  post-run ledger update.
- `src/app/api/cron/self-heal/route.ts` — hourly anti-drift run.
- `vercel.json` — register the cron.
- `scripts/generate-changelog.mjs` — `--check`, `--emit`, `--update`
  modes; `--check` rolls into anti-drift.
- `scripts/dep-rot-detector.mjs` — `--check` mode rolls into
  anti-drift.
- `docs/PROJECT-CONSTITUTION.md` — 7 immutable principles.
- `docs/SUCCESSION.md` — bus-factor handover.
- `docs/adr/TEMPLATE.md` — scaffold for future ADRs.
- `docs/adr/0004-*.md` — this ADR.
- `scripts/weekly-health.mjs` — new invariants for all the above.

## Alternatives left on the table

- **Auto-rotate provider keys when a runaway is detected.** Out of
  scope; would require coordinated rotation across 8 providers and
  a fleet-wide notification. Future ADR if it becomes urgent.
- **Real-time admin dashboard for cost-ledger streaming.** The
  current implementation queries the ledger on demand; a
  WebSocket-based live view is a future iteration.
- **A2E recursive-call counter.** A separate guard against agents
  calling agents calling agents. Cost-runaway catches this
  symptomatically (the recursion bills tokens), but a direct
  recursion-depth limit is a sharper tool. Future ADR.
