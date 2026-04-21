# Scheduled Playbooks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users schedule any playbook on a cron expression so "run every Monday at 9am" is a real feature. Changes the product from "one-shot agent" to "set it and forget it" — biggest retention lever in the short term.

**Architecture:** New `scheduled_playbooks` table stores the cron expression + inputs + next-run timestamp. A dispatcher cron runs every minute, selects rows where `nextRunAt <= now() AND active = true`, enqueues each via the existing QStash-backed queue (Plan 2.1 from the earlier sprint), then recomputes `nextRunAt`.

**Tech Stack:** Drizzle ORM · `cron-parser` npm library (MIT) · existing QStash queue · Vercel cron.

**Depends on:** Nothing — queue already exists from Phase 2.1 of the baseline sprint.

---

## File Structure

### Create
- `drizzle/0022_scheduled_playbooks.sql`
- `src/lib/scheduled-playbooks.ts` — CRUD + cron validation + next-run computation
- `src/app/api/playbooks/scheduled/route.ts` — GET list, POST create
- `src/app/api/playbooks/scheduled/[id]/route.ts` — GET/PATCH/DELETE
- `src/app/api/cron/dispatch-scheduled-playbooks/route.ts` — the dispatcher
- `src/app/dashboard/scheduled/page.tsx` — replaces the current empty page
- `src/components/dashboard/ScheduleForm.tsx` — cron picker UI (with friendly presets)

### Modify
- `src/db/schema.ts` — add `scheduledPlaybooks` table
- `vercel.json` — cron `/api/cron/dispatch-scheduled-playbooks` every minute

### Tests
- `src/lib/__tests__/scheduled-playbooks.test.ts` — cron validation, next-run math, create/update/delete
- `src/lib/__tests__/dispatch-cron.test.ts` — dispatcher behaviour (no-op when none due; enqueue when due; update next-run on success)

---

## Task 1: Migration + Drizzle schema

**Files:**
- Create: `drizzle/0022_scheduled_playbooks.sql`
- Modify: `src/db/schema.ts`

```sql
CREATE TABLE IF NOT EXISTS scheduled_playbooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  playbook_id      TEXT NOT NULL,
  inputs           TEXT NOT NULL DEFAULT '{}',
  cron_expression  TEXT NOT NULL,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at      TIMESTAMP NOT NULL,
  last_run_at      TIMESTAMP,
  last_run_id      UUID,
  run_count        INTEGER NOT NULL DEFAULT 0,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_playbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled_playbooks(next_run_at) WHERE active = TRUE;

ALTER TABLE scheduled_playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_select_own ON scheduled_playbooks;
CREATE POLICY scheduled_select_own ON scheduled_playbooks
  FOR SELECT USING (user_id = current_setting('app.current_user', true));
```

Drizzle:
```typescript
export const scheduledPlaybooks = pgTable("scheduled_playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  playbookId: text("playbook_id").notNull(),
  inputs: text("inputs").notNull().default("{}"),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  active: boolean("active").notNull().default(true),
  nextRunAt: timestamp("next_run_at").notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastRunId: uuid("last_run_id"),
  runCount: integer("run_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_user").on(table.userId),
  index("idx_scheduled_next_run").on(table.nextRunAt),
]);
```

TDD: schema test → FAIL → apply → PASS → commit.

Commit — `feat(scheduled): migration 0022 + Drizzle binding (plan 5.1)`

---

## Task 2: scheduled-playbooks.ts service module

**Files:**
- Create: `src/lib/scheduled-playbooks.ts`
- Test: `src/lib/__tests__/scheduled-playbooks.test.ts`
- Install: `npm install cron-parser`

Functions:
- `validateCron(expr: string): void` — throws if invalid
- `computeNextRun(expr: string, timezone: string, from?: Date): Date`
- `create(userId, input): ScheduleRow`
- `update(id, userId, patch): void`
- `deactivate(id, userId): void`
- `listByUser(userId): ScheduleRow[]`

Tests:
- Valid cron `0 9 * * 1` parses and next-run is the upcoming Monday 09:00
- Invalid cron throws with a readable message
- Timezone handling: `America/New_York` next-run respects DST

Commit — `feat(scheduled): service module with cron-parser (plan 5.2)`

---

## Task 3: CRUD API endpoints

**Files:**
- Create: `src/app/api/playbooks/scheduled/route.ts` (GET list, POST create)
- Create: `src/app/api/playbooks/scheduled/[id]/route.ts` (GET/PATCH/DELETE)

Request shape for POST:
```json
{
  "playbook_id": "lead-blitz",
  "inputs": { "niche": "SaaS" },
  "cron_expression": "0 9 * * 1",
  "timezone": "America/New_York"
}
```

Validation via Zod. All endpoints Clerk-auth-gated. Ownership check on update/delete.

Commit — `feat(scheduled): CRUD endpoints (plan 5.3)`

---

## Task 4: Dispatcher cron

**Files:**
- Create: `src/app/api/cron/dispatch-scheduled-playbooks/route.ts`
- Modify: `vercel.json` (cron `* * * * *`)
- Test: `src/lib/__tests__/dispatch-cron.test.ts`

Logic:
1. Auth `Bearer CRON_SECRET`
2. `SELECT ... WHERE active = true AND next_run_at <= now()` — limit 100 (prevents flooding)
3. For each row:
   - POST to `/api/playbooks/run` with the user's identity and inputs (using internal paired-header auth)
   - On success: update `last_run_at = now()`, `last_run_id = new run`, `run_count += 1`, `next_run_at = computeNextRun(...)`
   - On failure: `failure_count += 1`; if `failure_count >= 5` → `active = false` (auto-deactivate runaway failures)
4. Return summary `{dispatched, failed}`

Commit — `feat(scheduled): dispatcher cron every minute (plan 5.4)`

---

## Task 5: ScheduleForm component + scheduled page

**Files:**
- Create: `src/components/dashboard/ScheduleForm.tsx`
- Create: `src/app/dashboard/scheduled/page.tsx`

UI:
- List of user's active schedules with play/pause/delete
- "New schedule" modal:
  - Playbook picker (from `/api/playbooks`)
  - Input fields (dynamic based on selected playbook)
  - Cron picker with **friendly presets** (Every hour / Every day at X / Weekly on Monday / Monthly on day N) + advanced cron-expression input for power users
  - Timezone dropdown (default to user's browser timezone)
  - Preview: "Next run: Mon Apr 22 at 9:00 AM EST"

Commit — `feat(scheduled): scheduled playbooks dashboard (plan 5.5)`

---

## Task 6: Playbook run integration

Modify the POST `/api/playbooks/run` handler to accept an optional `{scheduledId: string}` in the body. When present, the run is tagged with that scheduled ID so the dispatcher can update the schedule row after the run finishes.

Commit — `feat(scheduled): link runs back to their schedule row (plan 5.6)`

---

## Quality Gate

- [ ] Migration 0022 applied
- [ ] cron-parser installed
- [ ] Create a test schedule "every minute" → observe dispatcher picks it up within 60s
- [ ] Deactivate test schedule → no more dispatches
- [ ] Delete test schedule → gone from UI
- [ ] Timezone test: schedule "every day at 09:00 America/New_York" → next-run computed correctly for DST transition
- [ ] Typecheck + all tests green
- [ ] `/dashboard/scheduled` renders with live data

## Open Questions

- Default cadence presets — what's the most common? Watch early telemetry (via PostHog event `schedule_created`) and refine.
- Rate-limit schedules per user? Starter could be 5 max, Growth 25, Sovereign unlimited.
- "Missed run" policy — if the dispatcher is delayed and a schedule is 6h overdue, should it fire once (catch-up) or skip? Default: skip — user can always re-run manually.
