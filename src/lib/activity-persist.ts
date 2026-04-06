/**
 * SOVEREIGN MATRIX — Agent Activity Persistence
 *
 * Writes agent execution records to the `agentActivity` table.
 * Used by agent-factory.ts to auto-log every execution (success + failure).
 *
 * Fire-and-forget: callers should .catch() to avoid blocking the response.
 */

import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("activity-persist");

export interface ActivityRecord {
  userId: string;
  projectId?: string;
  agentName: string;
  agentType: string;
  action: "completed" | "failed" | "scheduled";
  summary: string;
  result?: string;
  metadata?: string; // JSON string
}

/**
 * Persist an agent activity record to the database.
 * Non-blocking — designed to be called with .catch(() => {}).
 */
export async function persistAgentActivity(record: ActivityRecord): Promise<void> {
  try {
    await db.insert(agentActivity).values({
      userId: record.userId,
      projectId: record.projectId ?? null,
      agentName: record.agentName,
      agentType: record.agentType,
      action: record.action,
      summary: record.summary,
      result: record.result ?? null,
      metadata: record.metadata ?? null,
      isRead: false,
    });
  } catch (err) {
    // Never throw — this is fire-and-forget
    log.warn("Failed to persist agent activity", {
      agent: record.agentName,
      error: (err as Error).message,
    });
  }
}
