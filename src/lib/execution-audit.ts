import { createLogger } from "@/lib/logger";

const log = createLogger("execution-audit");

/**
 * EXECUTION AUDIT — Immutable log of every agent action.
 *
 * When Mythos-class models can chain exploits autonomously,
 * the audit trail is the last line of defense. Every agent call
 * is logged with: who, what, when, which model, what data accessed,
 * what output produced, and whether it was approved.
 *
 * Stored in-memory for now. Production: write to append-only DB table.
 */

export interface AuditEntry {
  id: string;
  timestamp: number;
  tenantId: string;
  agentName: string;
  modelUsed: string;
  input: string; // Truncated to 500 chars
  output: string; // Truncated to 500 chars
  safetyResult: {
    jailbreak: "pass" | "fail";
    pii: "pass" | "fail";
    content: "pass" | "fail";
    quality: number; // 0-100
    critic: "pass" | "fail";
  };
  trustLevel: number;
  approvalRequired: boolean;
  approvalStatus: "auto" | "approved" | "denied" | "pending";
  executionTimeMs: number;
  chainDepth: number;
  externalApisAccessed: string[];
  dataExported: boolean;
}

// In-memory audit log (production: use DB)
const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 10000;

export function logExecution(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const fullEntry: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    input: entry.input.slice(0, 500),
    output: entry.output.slice(0, 500),
  };

  auditLog.push(fullEntry);

  // Prevent memory bloat
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_LOG_SIZE);
  }

  // Log critical events
  if (entry.safetyResult.jailbreak === "fail") {
    log.error(`JAILBREAK BLOCKED: agent=${entry.agentName} tenant=${entry.tenantId}`);
  }
  if (entry.safetyResult.pii === "fail") {
    log.warn(`PII DETECTED: agent=${entry.agentName} tenant=${entry.tenantId}`);
  }
  if (entry.dataExported && entry.externalApisAccessed.length > 0) {
    log.warn(`DATA EXPORT TO EXTERNAL API: agent=${entry.agentName} apis=${entry.externalApisAccessed.join(",")}`);
  }
  if (entry.chainDepth > 5) {
    log.warn(`DEEP CHAIN: agent=${entry.agentName} depth=${entry.chainDepth}`);
  }

  return fullEntry;
}

export function getAuditLog(tenantId?: string, limit = 100): AuditEntry[] {
  const filtered = tenantId
    ? auditLog.filter(e => e.tenantId === tenantId)
    : auditLog;
  return filtered.slice(-limit);
}

export function getAuditStats(tenantId?: string): {
  total: number;
  blocked: number;
  autoApproved: number;
  manualApproved: number;
  avgExecutionMs: number;
  pipelinePassRate: number;
} {
  const entries = tenantId
    ? auditLog.filter(e => e.tenantId === tenantId)
    : auditLog;

  if (entries.length === 0) {
    return { total: 0, blocked: 0, autoApproved: 0, manualApproved: 0, avgExecutionMs: 0, pipelinePassRate: 0 };
  }

  const blocked = entries.filter(e =>
    e.safetyResult.jailbreak === "fail" ||
    e.safetyResult.content === "fail" ||
    e.approvalStatus === "denied"
  ).length;

  const autoApproved = entries.filter(e => e.approvalStatus === "auto").length;
  const manualApproved = entries.filter(e => e.approvalStatus === "approved").length;
  const avgMs = Math.round(entries.reduce((s, e) => s + e.executionTimeMs, 0) / entries.length);
  const passed = entries.filter(e =>
    e.safetyResult.jailbreak === "pass" &&
    e.safetyResult.pii === "pass" &&
    e.safetyResult.content === "pass" &&
    e.safetyResult.critic === "pass"
  ).length;

  return {
    total: entries.length,
    blocked,
    autoApproved,
    manualApproved,
    avgExecutionMs: avgMs,
    pipelinePassRate: Math.round((passed / entries.length) * 1000) / 10,
  };
}
