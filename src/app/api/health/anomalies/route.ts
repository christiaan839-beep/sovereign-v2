/**
 * GET /api/health/anomalies
 *
 * Round 67 — public anomaly findings endpoint. Surfaces the most
 * recent N findings emitted by the R57 detector. No auth — anomaly
 * data is part of the public reliability surface (procurement-readable).
 *
 * Cached for 60 seconds. The detector runs hourly; 60s freshness
 * is enough to surface critical findings to the /reliability page
 * without hammering the DB.
 *
 * Composition:
 *   - R57 detector → R67 cron → anomaly_findings row → this endpoint
 *   - R44 attestation cron also reads anomaly_findings to derive
 *     auditChainIntact for signed reliability commitments
 */

import { NextResponse } from "next/server";
import { desc, gte, eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-anomalies");

export const runtime = "nodejs";
export const revalidate = 60;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(
      parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10),
      1,
    ),
    MAX_LIMIT,
  );
  const severityFilter = url.searchParams.get("severity"); // optional: critical|warning|info
  const lookbackHours = Math.min(
    Math.max(parseInt(url.searchParams.get("hours") ?? "24", 10), 1),
    168, // 7 days
  );

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        findings: [],
        note: "Database unavailable; no anomaly findings to surface.",
      },
      { status: 200 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { anomalyFindings } = await import("@/db/schema");

    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const conditions = [gte(anomalyFindings.emittedAt, since)];
    if (
      severityFilter === "critical" ||
      severityFilter === "warning" ||
      severityFilter === "info"
    ) {
      conditions.push(eq(anomalyFindings.severity, severityFilter));
    }

    const rows = await db
      .select()
      .from(anomalyFindings)
      .where(and(...conditions))
      .orderBy(desc(anomalyFindings.emittedAt))
      .limit(limit);

    const counts = { critical: 0, warning: 0, info: 0 };
    for (const r of rows) {
      if (r.severity === "critical") counts.critical++;
      else if (r.severity === "warning") counts.warning++;
      else counts.info++;
    }
    const overallState =
      counts.critical > 0
        ? "critical"
        : counts.warning > 0
          ? "warning"
          : counts.info > 0
            ? "info"
            : "clean";

    return NextResponse.json(
      {
        findings: rows.map((r) => ({
          id: r.id,
          detectorRunId: r.detectorRunId,
          kind: r.kind,
          severity: r.severity,
          message: r.message,
          details: r.detailsJson,
          emittedAt: r.emittedAt.toISOString(),
          remediatedAt: r.remediatedAt?.toISOString() ?? null,
        })),
        summary: {
          totalFindings: rows.length,
          counts,
          overallState,
          lookbackHours,
        },
        note:
          "Anomaly findings are emitted hourly by the R57 detector via " +
          "the /api/cron/detect-anomalies cron. ML-free, statistical, " +
          "auditable. Findings are immutable once written.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    log.error("Anomaly findings lookup failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to load anomaly findings" },
      { status: 500 },
    );
  }
}
