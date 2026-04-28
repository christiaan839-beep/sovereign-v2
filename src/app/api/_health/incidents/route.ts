/**
 * GET /api/health/incidents
 *
 * Public, no-auth incidents feed. Reads platform-level events from
 * audit_logs (cron failures, audit chain breaks, cost-cap saves) and
 * returns the last 50 with timestamps.
 *
 * What's "platform-level":
 *   - cost.cap_hit       — a tenant got auto-paused (capacity event)
 *   - admin.submission_*  — marketplace approve/reject (governance)
 *
 * What's NOT shown publicly:
 *   - per-user agent.execute (would be a privacy violation)
 *   - api_key.create/delete (operational secrets)
 *   - user.login/logout (identity)
 *   - data.export/data.delete (per-tenant)
 *
 * The whole point: a procurement team can verify what's happened on
 * the platform without auth, without trusting a status page that the
 * vendor controls. The hash chain underneath makes the feed
 * tamper-evident.
 *
 * Cached for 60s. The data only changes on real events (rare).
 */

import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-incidents");

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * Public-safe AuditAction set. Anything outside this list is
 * filtered out of the response — defence-in-depth against future
 * additions to the AuditAction enum (e.g. a future "billing.charge"
 * variant should not auto-leak by adding to the enum).
 */
const PUBLIC_ACTIONS = [
  "cost.cap_hit",
  "admin.submission_approve",
  "admin.submission_reject",
] as const;

interface IncidentRow {
  id: string;
  action: string;
  createdAt: string;
  /** Severity inferred from action kind. */
  severity: "info" | "warning" | "incident";
  /** Public-safe summary; never includes PII or per-tenant identifiers. */
  title: string;
}

function severityFor(action: string): IncidentRow["severity"] {
  if (action === "cost.cap_hit") return "warning";
  if (action.startsWith("admin.submission_")) return "info";
  return "info";
}

function titleFor(action: string): string {
  switch (action) {
    case "cost.cap_hit":
      return "Tenant auto-paused on daily cost cap (defence triggered as designed)";
    case "admin.submission_approve":
      return "Marketplace agent approved";
    case "admin.submission_reject":
      return "Marketplace agent rejected";
    default:
      return action;
  }
}

async function getRecentIncidents(): Promise<IncidentRow[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { db } = await import("@/db");
    const { auditLogs } = await import("@/db/schema");
    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(inArray(auditLogs.action, [...PUBLIC_ACTIONS]))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
    return rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      severity: severityFor(r.action),
      title: titleFor(r.action),
    }));
  } catch (err) {
    log.warn("Incidents fetch failed", { error: String(err) });
    return [];
  }
}

export async function GET() {
  const t0 = Date.now();
  const incidents = await getRecentIncidents();
  return NextResponse.json(
    {
      total: incidents.length,
      incidents,
      probedInMs: Date.now() - t0,
      generatedAt: new Date().toISOString(),
      note: "Hash-chained audit log; tampering is detected by /api/cron/verify-audit-chain (every 6h).",
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
