/**
 * SCHEDULED PLAYBOOKS — cron-expression-driven recurring runs.
 *
 * Thin service layer over the scheduled_playbooks table. Validates
 * cron expressions (via `cron-parser` v5), computes next-run timestamps
 * with timezone awareness, and exposes the CRUD operations used by
 * the API routes + dispatcher cron.
 *
 * All timestamps are stored in UTC. The `timezone` column is an IANA
 * name ("America/New_York") — `cron-parser` applies it when computing
 * next_run_at so a schedule set to "0 9 * * 1" in NY fires at 09:00 EST
 * year-round (adjusting for DST transitions automatically).
 */

import { CronExpressionParser } from "cron-parser";
import { db } from "@/db";
import { scheduledPlaybooks } from "@/db/schema";
import { and, eq, lte, desc, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-playbooks");

// Max schedule rows a user can create. Enforced at the service layer so
// all three create-entry points (API route, admin tool, batch import)
// share the same ceiling. Adjust per tier in a future iteration — for
// now: everyone gets 25.
const MAX_SCHEDULES_PER_USER = 25;

// After this many consecutive failures, the dispatcher auto-deactivates
// the schedule so a broken playbook doesn't burn credits indefinitely.
export const FAILURE_AUTOPAUSE_THRESHOLD = 5;

export class CronValidationError extends Error {
  constructor(public readonly expression: string, cause: Error) {
    super(`Invalid cron expression "${expression}": ${cause.message}`);
    this.name = "CronValidationError";
  }
}

/**
 * Validate a cron expression — throws CronValidationError if invalid.
 * Accepts standard 5-field cron (minute hour dom month dow). 6 fields
 * (with leading seconds) is also accepted per cron-parser v5 behavior.
 *
 * cron-parser v5 silently accepts empty / single-word strings, so we
 * add an explicit shape check before handing it to the parser.
 */
export function validateCron(expression: string): void {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new CronValidationError(expression, new Error("empty expression"));
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) {
    throw new CronValidationError(
      expression,
      new Error(`expected 5 or 6 fields, got ${fields.length}`),
    );
  }
  try {
    CronExpressionParser.parse(trimmed);
  } catch (err) {
    throw new CronValidationError(expression, err as Error);
  }
}

/**
 * Compute the next run time given a cron expression and IANA timezone.
 * `from` defaults to now; pass a fixed Date in tests for reproducibility.
 *
 * Returns a UTC Date. The caller may format it in the user's timezone
 * for display — storage stays UTC.
 */
export function computeNextRun(
  expression: string,
  timezone: string = "UTC",
  from: Date = new Date(),
): Date {
  try {
    const interval = CronExpressionParser.parse(expression, {
      currentDate: from,
      tz: timezone,
    });
    return interval.next().toDate();
  } catch (err) {
    throw new CronValidationError(expression, err as Error);
  }
}

export interface ScheduleInput {
  playbookId: string;
  inputs?: Record<string, string>;
  cronExpression: string;
  timezone?: string;
  name?: string;
}

export interface ScheduleRow {
  id: string;
  userId: string;
  playbookId: string;
  inputs: string;
  cronExpression: string;
  timezone: string;
  active: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastRunId: string | null;
  runCount: number;
  failureCount: number;
  name: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** List all schedules owned by the caller (both active + paused). */
export async function listByUser(userId: string): Promise<ScheduleRow[]> {
  return db
    .select()
    .from(scheduledPlaybooks)
    .where(eq(scheduledPlaybooks.userId, userId))
    .orderBy(desc(scheduledPlaybooks.createdAt));
}

/** Get one schedule by ID — returns null if not found OR not owned by caller. */
export async function getById(id: string, userId: string): Promise<ScheduleRow | null> {
  const [row] = await db
    .select()
    .from(scheduledPlaybooks)
    .where(and(eq(scheduledPlaybooks.id, id), eq(scheduledPlaybooks.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Count of schedules a user currently owns — used to enforce the per-user cap. */
async function countByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: scheduledPlaybooks.id })
    .from(scheduledPlaybooks)
    .where(eq(scheduledPlaybooks.userId, userId));
  return rows.length;
}

export class QuotaExceededError extends Error {
  constructor(public readonly userId: string, public readonly limit: number) {
    super(`User ${userId} has reached the schedule quota (${limit})`);
    this.name = "QuotaExceededError";
  }
}

/**
 * Create a new schedule. Validates cron and computes the first
 * next_run_at. Throws QuotaExceededError if the user is at cap.
 */
export async function create(userId: string, input: ScheduleInput): Promise<ScheduleRow> {
  validateCron(input.cronExpression);

  const count = await countByUser(userId);
  if (count >= MAX_SCHEDULES_PER_USER) {
    throw new QuotaExceededError(userId, MAX_SCHEDULES_PER_USER);
  }

  const timezone = input.timezone ?? "UTC";
  const nextRunAt = computeNextRun(input.cronExpression, timezone);

  const [row] = await db
    .insert(scheduledPlaybooks)
    .values({
      userId,
      playbookId: input.playbookId,
      inputs: JSON.stringify(input.inputs ?? {}),
      cronExpression: input.cronExpression,
      timezone,
      active: true,
      nextRunAt,
      name: input.name ?? null,
    })
    .returning();

  log.info("Schedule created", { userId, scheduleId: row.id, nextRunAt });
  return row;
}

export interface SchedulePatch {
  cronExpression?: string;
  timezone?: string;
  inputs?: Record<string, string>;
  active?: boolean;
  name?: string;
}

/**
 * Update a schedule. Recomputes next_run_at if cron or timezone
 * changed. Ownership enforced — returns null if not found/owned.
 */
export async function update(
  id: string,
  userId: string,
  patch: SchedulePatch,
): Promise<ScheduleRow | null> {
  const existing = await getById(id, userId);
  if (!existing) return null;

  const newExpression = patch.cronExpression ?? existing.cronExpression;
  const newTimezone = patch.timezone ?? existing.timezone;

  if (patch.cronExpression || patch.timezone) {
    validateCron(newExpression);
  }

  const updateData: Partial<typeof scheduledPlaybooks.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.cronExpression) updateData.cronExpression = patch.cronExpression;
  if (patch.timezone) updateData.timezone = patch.timezone;
  if (patch.inputs !== undefined) updateData.inputs = JSON.stringify(patch.inputs);
  if (patch.active !== undefined) updateData.active = patch.active;
  if (patch.name !== undefined) updateData.name = patch.name;

  // Recompute next run if the cadence or timezone changed
  if (patch.cronExpression || patch.timezone) {
    updateData.nextRunAt = computeNextRun(newExpression, newTimezone);
    // Changing the cadence resets the failure count — user intent is
    // "this is a new setup, start fresh"
    updateData.failureCount = 0;
  }

  const [row] = await db
    .update(scheduledPlaybooks)
    .set(updateData)
    .where(and(eq(scheduledPlaybooks.id, id), eq(scheduledPlaybooks.userId, userId)))
    .returning();
  return row ?? null;
}

/** Delete a schedule. Returns true if a row was deleted. */
export async function remove(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(scheduledPlaybooks)
    .where(and(eq(scheduledPlaybooks.id, id), eq(scheduledPlaybooks.userId, userId)))
    .returning({ id: scheduledPlaybooks.id });
  return result.length > 0;
}

/**
 * Load schedules due for dispatch RIGHT NOW. Used by the dispatcher
 * cron. Limit parameter prevents flooding — if 1000 schedules are due
 * simultaneously we process in batches across minute ticks.
 */
export async function listDueNow(limit = 100): Promise<ScheduleRow[]> {
  return db
    .select()
    .from(scheduledPlaybooks)
    .where(
      and(
        eq(scheduledPlaybooks.active, true),
        lte(scheduledPlaybooks.nextRunAt, new Date()),
      ),
    )
    .orderBy(scheduledPlaybooks.nextRunAt)
    .limit(limit);
}

/**
 * Called by the dispatcher after a schedule has been enqueued. Updates
 * last_run_at, run_count, and next_run_at (recomputed forward).
 */
export async function markDispatched(
  id: string,
  runId: string,
  from: Date = new Date(),
): Promise<void> {
  const [current] = await db
    .select({ cronExpression: scheduledPlaybooks.cronExpression, timezone: scheduledPlaybooks.timezone })
    .from(scheduledPlaybooks)
    .where(eq(scheduledPlaybooks.id, id))
    .limit(1);
  if (!current) return;

  const nextRunAt = computeNextRun(current.cronExpression, current.timezone, from);

  await db
    .update(scheduledPlaybooks)
    .set({
      lastRunAt: from,
      lastRunId: runId,
      nextRunAt,
      runCount: sql`${scheduledPlaybooks.runCount} + 1`,
      // Successful dispatch resets the failure count
      failureCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPlaybooks.id, id));
}

/**
 * Called on dispatch failure. Increments failure_count and, if the
 * threshold is reached, auto-deactivates the schedule.
 */
export async function markFailed(id: string): Promise<void> {
  const [current] = await db
    .select({ failureCount: scheduledPlaybooks.failureCount })
    .from(scheduledPlaybooks)
    .where(eq(scheduledPlaybooks.id, id))
    .limit(1);
  if (!current) return;

  const newFailureCount = current.failureCount + 1;
  const shouldAutoPause = newFailureCount >= FAILURE_AUTOPAUSE_THRESHOLD;

  await db
    .update(scheduledPlaybooks)
    .set({
      failureCount: newFailureCount,
      active: shouldAutoPause ? false : undefined,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPlaybooks.id, id));

  if (shouldAutoPause) {
    log.warn("Schedule auto-paused after repeated failures", {
      scheduleId: id,
      failureCount: newFailureCount,
    });
  }
}

