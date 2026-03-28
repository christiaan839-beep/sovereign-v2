/**
 * SOVEREIGN MATRIX — Persistent Audit Trail
 *
 * Every agent execution, security event, and system action is logged
 * to the database. Required for SOC 2, POPIA, and GDPR compliance.
 *
 * Events are written to the `agentActivity` table (already exists in schema)
 * and can be queried for compliance reports, debugging, and analytics.
 */

import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit-trail");

export type AuditEventType =
  | "agent_executed"
  | "agent_failed"
  | "jailbreak_blocked"
  | "content_safety_blocked"
  | "pii_detected"
  | "pii_redacted"
  | "rate_limit_exceeded"
  | "auth_failed"
  | "cookbook_started"
  | "cookbook_completed"
  | "cookbook_failed"
  | "quality_regenerated"
  | "model_failover";

export interface AuditEvent {
  userId: string;
  agentName: string;
  agentType: string;
  action: AuditEventType;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to the database.
 * Non-blocking — failures are logged but don't crash the caller.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await db.insert(agentActivity).values({
      userId: event.userId,
      agentName: event.agentName,
      agentType: event.agentType,
      action: event.action,
      summary: event.summary,
      metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
      isRead: false,
    });
  } catch (err) {
    // Non-blocking: audit trail failure should never crash the agent
    log.error("Failed to log audit event", {
      event: event.action,
      agent: event.agentName,
      error: String(err),
    } as Record<string, unknown>);
  }
}

/**
 * Log agent execution (called by agent factory after every run).
 */
export async function logAgentExecution(
  userId: string,
  agentName: string,
  durationMs: number,
  qualityScore: number,
  model: string,
  success: boolean
): Promise<void> {
  await logAuditEvent({
    userId,
    agentName,
    agentType: agentName.split("-")[0] || "general",
    action: success ? "agent_executed" : "agent_failed",
    summary: success
      ? `${agentName} completed in ${durationMs}ms (quality: ${qualityScore.toFixed(2)}, model: ${model})`
      : `${agentName} failed after ${durationMs}ms`,
    metadata: { durationMs, qualityScore, model, success },
  });
}

/**
 * Log security events (jailbreak, content safety, PII, rate limit).
 */
export async function logSecurityEvent(
  userId: string,
  eventType: AuditEventType,
  agentName: string,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    userId,
    agentName,
    agentType: "security",
    action: eventType,
    summary: details,
    metadata,
  });
}
