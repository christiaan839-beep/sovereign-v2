# Observability + Continuous Evals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn production visibility from zero to elite. Sentry + PostHog wired with real DSNs, continuous evals every 6 hours with drift alerts, a per-agent cost dashboard, and SLO tracking for the top 5 user-facing flows.

**Architecture:** Sentry and PostHog adapters exist (Phase 1); this plan just turns them on. Continuous evals reuse the existing golden-set infrastructure but schedule via Vercel cron and persist results for trend analysis. Cost dashboard reads from `usage_cost_ledger` (already populated by every LLM call).

**Tech Stack:** Sentry · PostHog · Langfuse (already wrapped, just needs DSN) · Vercel cron · Drizzle · Existing `golden-set.ts` + `harness.ts`.

**Depends on:** Nothing — fully independent of Plans 1-3.

---

## File Structure

### Create
- `drizzle/0021_eval_runs.sql` — `eval_runs` + `eval_run_results` tables
- `src/app/api/cron/run-evals/route.ts` — cron endpoint that runs golden-set
- `src/app/api/_misc/admin/eval-health/route.ts` — admin read-only endpoint
- `src/app/api/_misc/admin/cost-breakdown/route.ts` — per-agent + per-user cost aggregates
- `src/app/dashboard/admin/eval-health/page.tsx` — trend charts
- `src/app/dashboard/admin/cost/page.tsx` — cost breakdown UI
- `src/lib/posthog-client.ts` — PostHog init + typed event wrappers
- `src/components/providers/PostHogProvider.tsx` — wraps the app
- `src/lib/slo-tracking.ts` — SLO definitions + Sentry alerts for breaches

### Modify
- `src/app/layout.tsx` — mount PostHogProvider
- `src/lib/env.ts` — add POSTHOG_KEY, POSTHOG_HOST to the Zod schema
- `vercel.json` — add `/api/cron/run-evals` schedule `0 */6 * * *`
- `.github/workflows/evals.yml` — add "Run eval baseline" step to the weekly cron

### Tests
- `src/lib/__tests__/eval-drift.test.ts` — pass-rate drop > 5% triggers alert
- `src/lib/__tests__/slo-tracking.test.ts` — SLO breach classification logic
- `src/lib/__tests__/posthog-events.test.ts` — typed wrappers produce correct payloads

---

## Task 1: Eval runs schema (migration 0021)

**Files:**
- Create: `drizzle/0021_eval_runs.sql`
- Modify: `src/db/schema.ts` (add two pgTable exports)

```sql
-- drizzle/0021_eval_runs.sql
CREATE TABLE IF NOT EXISTS eval_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  trigger       TEXT NOT NULL, -- 'scheduled' | 'manual' | 'ci'
  total         INTEGER NOT NULL DEFAULT 0,
  passed        INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER,
  pass_rate     REAL   -- passed / (total - skipped)
);
CREATE INDEX IF NOT EXISTS idx_eval_runs_started ON eval_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS eval_run_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  eval_slug     TEXT NOT NULL,
  agent_slug    TEXT NOT NULL,
  status        TEXT NOT NULL, -- 'passed' | 'failed' | 'skipped'
  duration_ms   INTEGER,
  error_message TEXT,
  output_hash   TEXT,          -- SHA-256 of canonical-json output, enables "output changed" detection
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_run_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_agent ON eval_run_results(agent_slug);
```

Drizzle bindings:
```typescript
export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  trigger: text("trigger").notNull(),
  total: integer("total").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  durationMs: integer("duration_ms"),
  passRate: text("pass_rate"),   // REAL in pg; read as string
}, (table) => [index("idx_eval_runs_started").on(table.startedAt)]);

export const evalRunResults = pgTable("eval_run_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => evalRuns.id, { onDelete: "cascade" }).notNull(),
  evalSlug: text("eval_slug").notNull(),
  agentSlug: text("agent_slug").notNull(),
  status: text("status").notNull(),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  outputHash: text("output_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

TDD as before (schema test, FAIL, apply, PASS, commit).

Commit — `feat(evals): eval_runs + eval_run_results tables (plan 4.1)`

---

## Task 2: Cron endpoint — run-evals

**Files:**
- Create: `src/app/api/cron/run-evals/route.ts`
- Modify: `vercel.json` (cron every 6 hours)

The endpoint reuses the existing `golden-set.ts` registrations. Instead of running under vitest, it imports each registered eval, invokes it directly, persists results to `eval_run_results`, and writes the summary to `eval_runs`.

```typescript
// sketch — see golden-set.ts registerEval shape
export async function GET(req: Request) {
  // Auth — Bearer CRON_SECRET
  // Create eval_runs row with status 'running'
  // For each registered eval in the golden set:
  //   try { run the input through the agent route, apply assertions }
  //   catch { status='failed', record error }
  // Upsert results into eval_run_results
  // Finalize eval_runs with pass_rate + completed_at
  // Compare pass_rate vs last completed run — if drop > 5pts:
  //   Sentry.captureMessage with severity=warning, include run IDs
}
```

TDD: mock the eval registry + the agent route fetches. Assert that 5+ results are persisted and pass_rate is computed correctly.

Commit — `feat(evals): /api/cron/run-evals scheduled every 6h (plan 4.2)`

---

## Task 3: Drift detection + Sentry alert

**Files:**
- Create: `src/lib/eval-drift.ts`
- Test: `src/lib/__tests__/eval-drift.test.ts`

Module with `detectDrift(previous, current): DriftReport` that returns `{drifted: boolean, deltaPct: number, affected: string[]}`.

Called from the run-evals cron after the final summary. Threshold: >5 percentage-point drop in overall pass rate, OR any individual eval flipping from passed → failed.

Sentry event uses `Sentry.captureMessage(message, "warning")` with `tags: {area: "evals", drift_pct: ...}` and `extra` payload listing affected eval slugs.

Commit — `feat(evals): drift detection + Sentry alert (plan 4.3)`

---

## Task 4: Eval health dashboard page

**Files:**
- Create: `src/app/api/_misc/admin/eval-health/route.ts` — returns last 30 runs with trend
- Create: `src/app/api/admin/eval-health/route.ts` — re-export
- Create: `src/app/dashboard/admin/eval-health/page.tsx`

UI: line chart of pass_rate over last 30 runs + table of the 10 most recently failed evals with timestamps. Uses the existing chart component patterns from `/dashboard/analytics`.

Commit — `feat(evals): admin eval-health dashboard (plan 4.4)`

---

## Task 5: PostHog wiring

**Files:**
- Create: `src/lib/posthog-client.ts`
- Create: `src/components/providers/PostHogProvider.tsx`
- Modify: `src/app/layout.tsx` (mount provider)
- Modify: `src/lib/env.ts` (add `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`)

```typescript
// src/lib/posthog-client.ts — typed event taxonomy
export type TrackedEvent =
  | { name: "landing_cta_click"; properties: { cta: string; path: string } }
  | { name: "signup_started"; properties: { source: string } }
  | { name: "signup_completed"; properties: { plan: string } }
  | { name: "playbook_run_started"; properties: { playbookId: string } }
  | { name: "playbook_run_completed"; properties: { playbookId: string; status: string; durationMs: number } }
  | { name: "agent_installed"; properties: { agentSlug: string; pricingCents: number } }
  | { name: "voice_session_started"; properties: { persona: string } }
  | { name: "upgrade_viewed"; properties: { from: string; reason: string } }
  | { name: "checkout_started"; properties: { plan: string } }
  | { name: "checkout_completed"; properties: { plan: string; amount: number } };

export function track<T extends TrackedEvent>(event: T): void {
  if (typeof window === "undefined") return;
  const posthog = (window as any).posthog;
  if (!posthog) return;
  posthog.capture(event.name, event.properties);
}
```

The typed wrapper is the key — it prevents the common mistake of scattering strings across the codebase.

Commit — `feat(observability): PostHog wired with typed event taxonomy (plan 4.5)`

---

## Task 6: Cost breakdown dashboard

**Files:**
- Create: `src/app/api/_misc/admin/cost-breakdown/route.ts`
- Create: `src/app/api/admin/cost/route.ts` — re-export
- Create: `src/app/dashboard/admin/cost/page.tsx`

Reads from the existing `usage_cost_ledger` (populated by every `nimChat` call via `recordLedgerEntry`).

API returns:
- Total cost last 7d / 30d
- Top 10 agents by cost
- Top 10 users by cost
- Per-model breakdown (which providers are we spending on?)

UI: 4 cards + 2 bar charts + a table. This is the answer to "which agents are eating our NIM budget."

Commit — `feat(observability): cost-breakdown admin dashboard (plan 4.6)`

---

## Task 7: SLO tracking

**Files:**
- Create: `src/lib/slo-tracking.ts`
- Test: `src/lib/__tests__/slo-tracking.test.ts`

Defines 5 SLOs for the platform:
1. `/api/health/deep` — availability 99.9% (30-day window)
2. Agent route latency p95 — <8s for interactive agents
3. Playbook run completion — 98% within 5 minutes
4. Stripe webhook success — 99.5%
5. Voice session latency p95 — <1.5s turn-end to first-audio (after Plan 3 ships)

The module exposes `recordSample(slo, value, pass: boolean)` that Sentry-wraps. A weekly cron computes breach reports and posts to Slack (existing webhook via `SLACK_WEBHOOK_URL`).

Commit — `feat(observability): SLO tracking + weekly breach reports (plan 4.7)`

---

## Quality Gate

- [ ] Migration 0021 applied
- [ ] Cron runs evals every 6h in prod (verify via first scheduled run)
- [ ] Drift alert fires in Sentry on manual pass_rate drop simulation
- [ ] PostHog receiving events in dev (verify in PostHog UI)
- [ ] Cost dashboard loads with real numbers
- [ ] SLO tests pass
- [ ] Typecheck + all tests green
