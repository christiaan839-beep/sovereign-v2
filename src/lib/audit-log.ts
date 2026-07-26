import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit");

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "agent.execute"
  | "settings.update"
  | "api_key.create"
  | "api_key.delete"
  | "subscription.change"
  | "webhook.received"
  | "data.export"
  | "data.delete"
  | "data.audit-bundle"
  | "admin.provision"
  | "credits.add"
  | "credits.purchase"
  | "credits.grant"
  | "admin.grant"
  | "admin.revoke"
  | "marketplace.submit"
  | "marketplace.draft"
  | "marketplace.submitted"
  | "marketplace.approved"
  | "marketplace.rejected"
  | "marketplace.published"
  | "marketplace.unpublished"
  | "marketplace.run"
  | "marketplace.connect"
  | "webauthn.credential.registered"
  | "webauthn.credential.revoked"
  | "webauthn.assertion.ok"
  | "webauthn.assertion.failed"
  | "agent_token.issued"
  | "agent_token.revoked"
  | "portal_link.issued"
  | "defense.block"
  | "capability.invoke"
  | "trs.attestation"
  | "adversarial.eval"
  | "data.delete-receipt"
  | "honeypot.bulletin"
  | "honeypot.signal"
  | "execution.exhausted";

interface AuditEntry {
  userId: string;
  action: AuditAction;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.execute(
      sql`INSERT INTO audit_logs (user_id, action, resource, details, ip_address, created_at)
          VALUES (${entry.userId}, ${entry.action}, ${entry.resource || null}, ${JSON.stringify(entry.details || {})}, ${entry.ipAddress || null}, NOW())`,
    );
  } catch (err) {
    // Audit logging should never break the app
    log.error("Audit log write failed", err as Record<string, unknown>);
  }
}
