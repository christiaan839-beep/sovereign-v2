/**
 * GET /api/leaderboard — top-50 agents by the chosen metric.
 *
 * Query:
 *   sort   = success (default) | cost | speed | earnings
 *   window = 30d (default)     | 7d   | all
 *
 * Metrics (all over the window):
 *   success   : successes / runs desc, tiebreak by runs desc
 *   cost      : totalCostCents / runs asc (cheapest first)
 *   speed     : avgDurationMs asc
 *   earnings  : totalCostCents desc (proxy for creator revenue)
 *
 * Agents with zero runs in the window are filtered out — a 0-run ranking
 * is meaningless (infinite cost-per-run, NaN success rate).
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentMetadata, agentStatsDaily } from "@/db/schema";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

type Sort = "success" | "cost" | "speed" | "earnings";
type Window = "7d" | "30d" | "all";

const VALID_SORT: ReadonlySet<Sort> = new Set(["success", "cost", "speed", "earnings"]);
const VALID_WINDOW: ReadonlySet<Window> = new Set(["7d", "30d", "all"]);

const LIMIT = 50;

function sinceISO(window: Window): string | null {
  if (window === "all") return null;
  const days = window === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sortParam = (url.searchParams.get("sort") ?? "success") as Sort;
  const windowParam = (url.searchParams.get("window") ?? "30d") as Window;

  if (!VALID_SORT.has(sortParam)) {
    return NextResponse.json(
      { error: "Invalid sort", valid: [...VALID_SORT] },
      { status: 400 },
    );
  }
  if (!VALID_WINDOW.has(windowParam)) {
    return NextResponse.json(
      { error: "Invalid window", valid: [...VALID_WINDOW] },
      { status: 400 },
    );
  }

  const since = sinceISO(windowParam);

  // Build the rollup join. Aggregates are computed in SQL so we don't ship
  // 30d × 223 agents worth of rows back just to sort in JS.
  const runs = sql<number>`COALESCE(SUM(${agentStatsDaily.runs}), 0)::int`.as("runs");
  const successes = sql<number>`COALESCE(SUM(${agentStatsDaily.successes}), 0)::int`.as("successes");
  const avgDuration = sql<number | null>`AVG(${agentStatsDaily.avgDurationMs})::int`.as("avgDurationMs");
  const totalCost = sql<number>`COALESCE(SUM(${agentStatsDaily.totalCostCents}), 0)::int`.as("totalCostCents");
  const successRate = sql<number>`
    CASE WHEN COALESCE(SUM(${agentStatsDaily.runs}), 0) = 0
      THEN 0
      ELSE (SUM(${agentStatsDaily.successes})::float / SUM(${agentStatsDaily.runs}))
    END
  `.as("successRate");
  const costPerRun = sql<number>`
    CASE WHEN COALESCE(SUM(${agentStatsDaily.runs}), 0) = 0
      THEN 0
      ELSE (SUM(${agentStatsDaily.totalCostCents})::float / SUM(${agentStatsDaily.runs}))
    END
  `.as("costPerRun");

  // Order expression — picked by query param.
  const orderBy = (() => {
    switch (sortParam) {
      case "speed": return asc(avgDuration);
      case "cost": return asc(costPerRun);
      case "earnings": return desc(totalCost);
      case "success":
      default:
        return desc(successRate);
    }
  })();

  const whereClause = since
    ? and(
        eq(agentStatsDaily.agentSlug, agentMetadata.slug),
        gte(agentStatsDaily.day, since),
      )
    : eq(agentStatsDaily.agentSlug, agentMetadata.slug);

  const rows = (await db
    .select({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      category: agentMetadata.category,
      verified: agentMetadata.verified,
      creatorHandle: agentMetadata.creatorHandle,
      runs,
      successes,
      avgDurationMs: avgDuration,
      totalCostCents: totalCost,
      successRate,
      costPerRun,
    })
    .from(agentMetadata)
    .innerJoin(agentStatsDaily, whereClause)
    .groupBy(agentMetadata.slug)
    // Filter out agents with 0 runs in the window — no meaningful ranking
    .having(sql`COALESCE(SUM(${agentStatsDaily.runs}), 0) > 0`)
    .orderBy(orderBy)
    .limit(LIMIT)) as unknown as Array<{
      slug: string;
      displayName: string;
      category: string;
      verified: boolean;
      creatorHandle: string | null;
      runs: number;
      successes: number;
      avgDurationMs: number | null;
      totalCostCents: number;
      successRate: number;
      costPerRun: number;
    }>;

  return NextResponse.json(
    {
      entries: rows,
      sort: sortParam,
      window: windowParam,
      total: rows.length,
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=120" } },
  );
}
