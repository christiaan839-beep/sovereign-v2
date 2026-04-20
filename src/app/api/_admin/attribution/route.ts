import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { and, desc, gte, isNotNull, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { csvEscape, safeRefDomain } from "@/lib/csv";

const log = createLogger("admin:attribution");

/**
 * GET /api/_admin/attribution
 *
 * Channel analysis surface for the founder. During launch week the
 * attribution pipeline writes first-touch data on every signup; this
 * endpoint exposes it so we can answer "did HN or LinkedIn drive
 * Tuesday's signups?"
 *
 * Query params:
 *   ?window=7d|30d|all  — time window (default 30d)
 *   ?format=json|csv    — response format (default json, csv for
 *                          exporting into Sheets/Excel/Notion)
 *   ?limit=1000         — cap for CSV exports (safety)
 *
 * JSON response:
 *   {
 *     window: "30d",
 *     totalSignups: number,
 *     bySource: [{ source, count, percent }],
 *     byMedium: [{ medium, count }],
 *     byCampaign: [{ campaign, count }],
 *     topReferrers: [{ referrer, count }],
 *   }
 *
 * CSV includes per-row: acquired_at, source, medium, campaign,
 * referrer, plan, userIdHash (SHA-256-prefix for correlation
 * without leaking the Clerk id).
 *
 * Admin-gated via requireAdmin() — 404 for non-admins so the
 * endpoint's existence isn't leaked.
 */

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const window = (url.searchParams.get("window") ?? "30d").toLowerCase();
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const limit = Math.min(10_000, Math.max(1, Number(url.searchParams.get("limit") ?? 1000)));

  const windowMs: Record<string, number> = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    "all": Number.POSITIVE_INFINITY,
  };
  const spanMs = windowMs[window] ?? windowMs["30d"];
  const since = Number.isFinite(spanMs)
    ? new Date(Date.now() - spanMs)
    : new Date(0);

  try {
    // ── Aggregate counts ──
    const [totalSignups, bySource, byMedium, topReferrers] = await Promise.all([
      db
        .select({ value: count() })
        .from(subscriptions)
        .where(gte(subscriptions.acquiredAt, since))
        .catch(() => [{ value: 0 }]),

      db
        .select({
          source: subscriptions.acquisitionSource,
          count: count(),
        })
        .from(subscriptions)
        .where(gte(subscriptions.acquiredAt, since))
        .groupBy(subscriptions.acquisitionSource)
        .orderBy(desc(count()))
        .catch(() => []),

      db
        .select({
          medium: subscriptions.acquisitionMedium,
          count: count(),
        })
        .from(subscriptions)
        .where(gte(subscriptions.acquiredAt, since))
        .groupBy(subscriptions.acquisitionMedium)
        .orderBy(desc(count()))
        .catch(() => []),

      db
        .select({
          referrer: subscriptions.acquisitionReferrer,
          count: count(),
        })
        .from(subscriptions)
        .where(
          and(
            gte(subscriptions.acquiredAt, since),
            isNotNull(subscriptions.acquisitionReferrer),
          ),
        )
        .groupBy(subscriptions.acquisitionReferrer)
        .orderBy(desc(count()))
        .limit(20)
        .catch(() => []),
    ]);

    const total = Number(totalSignups[0]?.value ?? 0);

    const sourceData = bySource.map((r) => ({
      source: r.source ?? "(unset)",
      count: Number(r.count),
      percent: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
    }));

    const mediumData = byMedium.map((r) => ({
      medium: r.medium ?? "(unset)",
      count: Number(r.count),
    }));

    const referrerData = topReferrers.map((r) => ({
      referrer: r.referrer ?? "",
      count: Number(r.count),
    }));

    if (format === "csv") {
      // ── CSV export: one row per signup, capped ──
      const rows = await db
        .select({
          acquiredAt: subscriptions.acquiredAt,
          source: subscriptions.acquisitionSource,
          medium: subscriptions.acquisitionMedium,
          campaign: subscriptions.acquisitionCampaign,
          referrer: subscriptions.acquisitionReferrer,
          plan: subscriptions.plan,
          userId: subscriptions.userId,
        })
        .from(subscriptions)
        .where(gte(subscriptions.acquiredAt, since))
        .orderBy(desc(subscriptions.acquiredAt))
        .limit(limit);

      const { createHash } = await import("node:crypto");
      const headers = ["acquired_at", "source", "medium", "campaign", "referrer_domain", "plan", "user_id_hash"];
      const csvLines = [headers.join(",")];
      for (const row of rows) {
        const refDomain = safeRefDomain(row.referrer);
        const userIdHash = createHash("sha256").update(row.userId).digest("hex").slice(0, 12);
        csvLines.push([
          row.acquiredAt?.toISOString() ?? "",
          csvEscape(row.source),
          csvEscape(row.medium),
          csvEscape(row.campaign),
          csvEscape(refDomain),
          csvEscape(row.plan),
          userIdHash,
        ].join(","));
      }
      return new NextResponse(csvLines.join("\r\n") + "\r\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attribution-${window}-${Date.now()}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      window,
      since: since.toISOString(),
      totalSignups: total,
      bySource: sourceData,
      byMedium: mediumData,
      topReferrers: referrerData,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42703" || code === "42P01") {
      return NextResponse.json({
        window,
        totalSignups: 0,
        bySource: [],
        byMedium: [],
        topReferrers: [],
        note: "Attribution columns not yet migrated (0013). Run migration to enable.",
      });
    }
    log.error("attribution query failed", { error: String(err) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

