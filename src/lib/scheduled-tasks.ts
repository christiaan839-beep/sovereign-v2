/**
 * SOVEREIGN MATRIX — Scheduled Task Registry
 *
 * Central registry for recurring background tasks with cron expressions.
 * Each task maps to a handler function in the email or analytics services.
 *
 * Cron format: minute hour dayOfMonth month dayOfWeek
 *   "0 8 * * 1"   → every Monday at 8:00 AM
 *   "0 8 * * *"   → every day at 8:00 AM
 */

// ── Types ──

export interface ScheduledTask {
  /** Unique identifier for the task */
  id: string;
  /** Human-readable name */
  name: string;
  /** Cron expression (UTC) */
  schedule: string;
  /** Name of the handler function to invoke */
  handlerName: string;
  /** Whether the task is currently active */
  enabled: boolean;
  /** Optional description */
  description?: string;
}

// ── Task Registry ──

const tasks: ScheduledTask[] = [
  {
    id: "weekly-report",
    name: "Weekly Performance Report",
    schedule: "0 8 * * 1", // every Monday at 8:00 AM
    handlerName: "sendWeeklyReport",
    enabled: true,
    description:
      "Sends a weekly email report summarizing agent executions, usage stats, and top-performing agents.",
  },
  {
    id: "daily-digest",
    name: "Daily Activity Digest",
    schedule: "0 8 * * *", // every day at 8:00 AM
    handlerName: "sendDailyDigest",
    enabled: true,
    description:
      "Sends a daily email digest with previous day agent runs, errors, and usage highlights.",
  },
];

// ── Public API ──

/**
 * Return all registered scheduled tasks.
 */
export function getScheduledTasks(): ScheduledTask[] {
  return tasks;
}

/**
 * Find a specific task by its ID.
 * Returns undefined if no task matches.
 */
export function getTaskById(id: string): ScheduledTask | undefined {
  return tasks.find((t) => t.id === id);
}
