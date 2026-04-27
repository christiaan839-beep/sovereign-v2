/**
 * SOVEREIGN MATRIX — Automation Scheduler
 *
 * CRUD operations for scheduled workflow tasks.
 * Tasks are stored in the `settings` table under the `scheduledTasks` JSON key.
 * Does NOT implement actual cron execution — the cron API routes
 * (`src/app/api/cron/`) trigger these at runtime.
 *
 * Supports common cron patterns:
 *   * * * * *     every minute
 *   0 * * * *     every hour
 *   0 9 * * *     daily at 9am
 *   0 9 * * 1     weekly Monday at 9am
 *   0 9 1 * *     monthly on 1st at 9am
 */

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { safeJsonParseObject } from "@/lib/safe-json";

const log = createLogger("scheduler");

// ─── Types ───

export interface ScheduledTask {
  id: string;
  workflowId: string;
  cron: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

interface StoredTask {
  id: string;
  workflowId: string;
  cron: string;
  enabled: boolean;
  lastRun?: string; // ISO string for JSON serialization
  nextRun?: string;
}

interface SettingsConfig {
  scheduledTasks?: StoredTask[];
  [key: string]: unknown;
}

// ─── Cron Parser ───

/**
 * Simple next-run calculator for common cron patterns.
 * Handles: every minute, hourly, daily, weekly (by day-of-week), monthly.
 */
export function parseNextRun(cron: string): Date {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${cron}" — expected 5 fields`);
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const now = new Date();
  const next = new Date(now);

  // Every minute: * * * * *
  if (minute === "*" && hour === "*") {
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return next;
  }

  const targetMinute = minute === "*" ? 0 : parseInt(minute, 10);
  const targetHour = hour === "*" ? -1 : parseInt(hour, 10);

  // Every hour at specific minute: N * * * *
  if (targetHour === -1) {
    next.setSeconds(0, 0);
    next.setMinutes(targetMinute);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }

  // Weekly on specific day: N N * * DOW
  if (dayOfWeek !== "*") {
    const targetDow = parseInt(dayOfWeek, 10); // 0=Sun, 1=Mon, ...
    next.setSeconds(0, 0);
    next.setHours(targetHour, targetMinute, 0, 0);

    const currentDow = next.getDay();
    let daysAhead = targetDow - currentDow;
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0 && next <= now) daysAhead = 7;

    next.setDate(next.getDate() + daysAhead);
    return next;
  }

  // Monthly on specific day: N N DOM * *
  if (dayOfMonth !== "*") {
    const targetDom = parseInt(dayOfMonth, 10);
    next.setSeconds(0, 0);
    next.setHours(targetHour, targetMinute, 0, 0);
    next.setDate(targetDom);

    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDom);
    }
    return next;
  }

  // Daily at specific time: N N * * *
  next.setSeconds(0, 0);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// ─── Settings Helpers ───

async function getConfig(userEmail: string): Promise<SettingsConfig> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.userEmail, userEmail),
  });
  if (!row) return {};
  return safeJsonParseObject<SettingsConfig>(
    row.config,
    "settings.config (scheduler)",
  );
}

async function saveConfig(userEmail: string, config: SettingsConfig): Promise<void> {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.userEmail, userEmail),
  });

  const configStr = JSON.stringify(config);

  if (existing) {
    await db.update(settings)
      .set({ config: configStr })
      .where(eq(settings.userEmail, userEmail));
  } else {
    await db.insert(settings).values({
      userEmail,
      config: configStr,
    });
  }
}

function storedToTask(stored: StoredTask): ScheduledTask {
  return {
    id: stored.id,
    workflowId: stored.workflowId,
    cron: stored.cron,
    enabled: stored.enabled,
    lastRun: stored.lastRun ? new Date(stored.lastRun) : undefined,
    nextRun: stored.nextRun ? new Date(stored.nextRun) : undefined,
  };
}

function taskToStored(task: ScheduledTask): StoredTask {
  return {
    id: task.id,
    workflowId: task.workflowId,
    cron: task.cron,
    enabled: task.enabled,
    lastRun: task.lastRun?.toISOString(),
    nextRun: task.nextRun?.toISOString(),
  };
}

// ─── CRUD ───

/**
 * Get all scheduled tasks for a user.
 */
export async function getScheduledTasks(userId: string): Promise<ScheduledTask[]> {
  const config = await getConfig(userId);
  const stored = config.scheduledTasks || [];
  return stored.map(storedToTask);
}

/**
 * Create a new scheduled task.
 */
export async function createScheduledTask(
  userId: string,
  task: Omit<ScheduledTask, "id">
): Promise<ScheduledTask> {
  const config = await getConfig(userId);
  const stored = config.scheduledTasks || [];

  const newTask: ScheduledTask = {
    ...task,
    id: crypto.randomUUID(),
    nextRun: task.enabled ? parseNextRun(task.cron) : undefined,
  };

  stored.push(taskToStored(newTask));
  config.scheduledTasks = stored;
  await saveConfig(userId, config);

  log.info("Created scheduled task", { userId, taskId: newTask.id, cron: newTask.cron });
  return newTask;
}

/**
 * Delete a scheduled task by ID.
 */
export async function deleteScheduledTask(userId: string, taskId: string): Promise<void> {
  const config = await getConfig(userId);
  const stored = config.scheduledTasks || [];

  const filtered = stored.filter((t) => t.id !== taskId);
  if (filtered.length === stored.length) {
    throw new Error(`Task ${taskId} not found`);
  }

  config.scheduledTasks = filtered;
  await saveConfig(userId, config);

  log.info("Deleted scheduled task", { userId, taskId });
}
