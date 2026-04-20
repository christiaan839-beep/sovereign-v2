import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { subscriptions, usage, playbookRuns } from "@/db/schema";
import { count, gte, sql, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-stats");

/**
 * GET /api/_admin/stats
 *
 * Founder ops dashboard data. Returns platform-wide counters:
 *   - total users + subscription breakdown
 *   - agent runs today / this week / this month
 *   - playbook runs + success rate
 *   - Founder Network occupancy
 *   - recent error rate (if Sentry is wired)
 *
 * Admin-only. Non-admins get 404 (don't reveal the endpoint exists).
 *
 * This is the data source for /dashboard/admin.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all counter queries in parallel — admin dashboard should
    // load under 500ms even on a warm prod DB.
    const [
      totalSubs,
      plansBreakdown,
      runsToday,
      runsWeek,
      runsMonth,
      playbookStats,
      founderNetworkCount,
    ] = await Promise.all([
      db.select({ value: count() }).from(subscriptions),

      db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          count: count(),
        })
        .from(subscriptions)
        .groupBy(subscriptions.plan, subscriptions.status),

      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, dayAgo)),

      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, weekAgo)),

      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, monthAgo)),

      db
        .select({
          status: playbookRuns.status,
          count: count(),
          avgMs: sql<number | null>`avg(${playbookRuns.durationMs})`,
        })
        .from(playbookRuns)
        .where(gte(playbookRuns.createdAt, weekAgo))
        .groupBy(playbookRuns.status),

      db
        .select({ value: count() })
        .from(subscriptions)
        .where(isNotNull(subscriptions.founderNetworkJoinedAt))
        .catch(() => [{ value: 0 }]), // Column may not exist pre-migration-0009
    ]);

    const successRuns =
      playbookStats.find((r) => r.status === "done")?.count ?? 0;
    const failedRuns =
      playbookStats.find((r) => r.status === "failed")?.count ?? 0;
    const totalPlaybookRuns = successRuns + failedRuns;

    return NextResponse.json({
      generatedAt: now.toISOString(),
      users: {
        total: Number(totalSubs[0]?.value ?? 0),
        byPlanStatus: plansBreakdown.map((r) => ({
          plan: r.plan,
          status: r.status,
          count: Number(r.count),
        })),
      },
      agentRuns: {
        today: Number(runsToday[0]?.value ?? 0),
        thisWeek: Number(runsWeek[0]?.value ?? 0),
        thisMonth: Number(runsMonth[0]?.value ?? 0),
      },
      playbooks: {
        succeeded: Number(successRuns),
        failed: Number(failedRuns),
        successRate:
          totalPlaybookRuns > 0
            ? Math.round((successRuns / totalPlaybookRuns) * 100)
            : null,
        avgDurationMs: playbookStats.reduce(
          (acc, r) => acc + (r.avgMs ?? 0) * r.count,
          0,
        ) / Math.max(1, totalPlaybookRuns),
      },
      founderNetwork: {
        claimed: Number(founderNetworkCount[0]?.value ?? 0),
        remaining: 100 - Number(founderNetworkCount[0]?.value ?? 0),
      },
    });
  } catch (err) {
    log.error("admin stats failed", { error: String(err) });
    return NextResponse.json(
      { error: "Stats query failed" },
      { status: 500 },
    );
  }
}
