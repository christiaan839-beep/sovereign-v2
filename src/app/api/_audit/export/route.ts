import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { auditLogs, usage } from "@/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { csvEscape } from "@/lib/csv";

const log = createLogger("audit-export");

/**
 * GET /api/_audit/export
 *
 * Compliance-grade audit log export. Supports two scopes:
 *
 *   ?scope=self  — the caller's own audit events. Required for
 *                  POPIA Art. 23 / GDPR Art. 15 (right of access)
 *                  and Art. 20 (data portability). Every authenticated
 *                  user can export their own data.
 *
 *   ?scope=all   — platform-wide audit log. Admin-only. Required
 *                  for SOC 2 CC7 (system operations) evidence
 *                  collection and enterprise customer security
 *                  reviews.
 *
 * Format: `?format=csv` (default) or `?format=json`.
 * Range:  `?from=ISO8601` + `?to=ISO8601` (default: last 30 days).
 * Limit:  `?limit=10000` (default), max 100000 per request.
 *
 * Data emitted:
 *   audit_logs.* — every action the user took
 *   usage.*      — every agent run (for activity-count verification)
 *
 * Security notes:
 *   - `scope=self` is SAFE because RLS (or our WHERE user_id = caller)
 *     naturally limits the rows.
 *   - `scope=all` is admin-gated via requireAdmin() — non-admins see 404.
 *   - Never include raw AI output bodies in the export — those could
 *     contain third-party data (customer prompts) that belong to the
 *     user, not us. We redact `details` columns longer than 500 chars.
 *   - CSV uses quoted-field escaping (RFC 4180) to survive commas +
 *     newlines in log bodies.
 *
 * The response sets `Content-Disposition: attachment` so the browser
 * saves it as a file rather than rendering — protects against the
 * "JSON in URL" XSS vector.
 */

type ExportScope = "self" | "all";

interface ExportRow {
  ts: string;
  source: "audit_logs" | "usage";
  userId: string;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope") ?? "self";
  const format = url.searchParams.get("format") ?? "csv";
  const limit = Math.min(
    100_000,
    Math.max(1, Number(url.searchParams.get("limit") ?? 10_000)),
  );

  if (scopeParam !== "self" && scopeParam !== "all") {
    return NextResponse.json(
      { error: "Invalid scope. Must be 'self' or 'all'." },
      { status: 400 },
    );
  }
  const scope = scopeParam as ExportScope;

  // scope=all requires admin — enforce at the top so we fail fast.
  if (scope === "all" && !isAdmin(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Date range: default last 30 days.
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : defaultFrom;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date format — use ISO 8601" }, { status: 400 });
  }
  if (from.getTime() > to.getTime()) {
    return NextResponse.json({ error: "'from' must be before 'to'" }, { status: 400 });
  }

  // Query both audit_logs and usage in parallel.
  // When scope=self we scope by userId; when scope=all we drop that filter.
  const auditWhere = scope === "self"
    ? and(eq(auditLogs.userId, userId), gte(auditLogs.createdAt, from), lte(auditLogs.createdAt, to))
    : and(gte(auditLogs.createdAt, from), lte(auditLogs.createdAt, to));

  const usageWhere = scope === "self"
    ? and(eq(usage.userId, userId), gte(usage.createdAt, from), lte(usage.createdAt, to))
    : and(gte(usage.createdAt, from), lte(usage.createdAt, to));

  let auditRows: Array<typeof auditLogs.$inferSelect> = [];
  let usageRows: Array<typeof usage.$inferSelect> = [];

  try {
    [auditRows, usageRows] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(auditWhere)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit),
      db
        .select()
        .from(usage)
        .where(usageWhere)
        .orderBy(desc(usage.createdAt))
        .limit(limit),
    ]);
  } catch (err) {
    log.error("audit export query failed", { error: String(err), scope });
    return NextResponse.json({ error: "Export query failed" }, { status: 500 });
  }

  // Merge into unified row format, then sort by timestamp desc.
  const rows: ExportRow[] = [
    ...auditRows.map((r) => ({
      ts: r.createdAt?.toISOString() ?? "",
      source: "audit_logs" as const,
      userId: r.userId,
      action: r.action,
      resource: r.resource,
      details: redactLongBody(r.details),
      ipAddress: r.ipAddress,
    })),
    ...usageRows.map((r) => ({
      ts: r.createdAt?.toISOString() ?? "",
      source: "usage" as const,
      userId: r.userId,
      action: "agent_run",
      resource: r.agentId,
      // `usage` only stores metadata (model, tokens) — no prompt body, so
      // this export is inherently privacy-friendly.
      details: `model=${r.model} tokens=${r.tokensUsed}`,
      ipAddress: null,
    })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  const filename = `audit-${scope}-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}`;

  log.info("audit export", { userId, scope, rowCount: rows.length });

  if (format === "json") {
    return new NextResponse(
      JSON.stringify({
        meta: {
          exportedAt: now.toISOString(),
          scope,
          from: from.toISOString(),
          to: to.toISOString(),
          rowCount: rows.length,
          limit,
        },
        rows,
      }, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // CSV (default) — RFC 4180 compliant.
  const headers = ["timestamp", "source", "user_id", "action", "resource", "details", "ip_address"];
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.ts, r.source, r.userId, r.action, r.resource, r.details, r.ipAddress]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const csv = csvLines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Truncate very long body strings to prevent exposing full customer data. */
function redactLongBody(s: string | null): string | null {
  if (s === null || s === undefined) return null;
  if (s.length > 500) return s.slice(0, 497) + "...";
  return s;
}
