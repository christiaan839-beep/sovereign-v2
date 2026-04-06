import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentActivity, leads, generations, subscriptions } from "@/db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("usage-api");

/**
 * USAGE METERING API — Per-user consumption metrics
 *
 * Returns detailed usage data for the authenticated user:
 * - Agent executions (24h, 7d, 30d, all-time)
 * - Top agents used
 * - Leads generated
 * - Content generated
 * - Current plan and limits
 *
 * Used by: billing page, usage dashboard, upgrade prompts
 */

import { getPlan, getPlanLimit, normalizePlanId } from "@/lib/plans";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      executions24h,
      executions7d,
      executions30d,
      executionsAll,
      topAgents,
      leadsCount,
      generationsCount,
      userSub,
    ] = await Promise.all([
      // Agent executions by time period
      db.select({ value: count() }).from(agentActivity)
        .where(and(eq(agentActivity.userId, userId), gte(agentActivity.createdAt, day1))),
      db.select({ value: count() }).from(agentActivity)
        .where(and(eq(agentActivity.userId, userId), gte(agentActivity.createdAt, day7))),
      db.select({ value: count() }).from(agentActivity)
        .where(and(eq(agentActivity.userId, userId), gte(agentActivity.createdAt, day30))),
      db.select({ value: count() }).from(agentActivity)
        .where(eq(agentActivity.userId, userId)),

      // Top 5 agents
      db.select({
        agent: agentActivity.agentName,
        executions: count(),
      })
        .from(agentActivity)
        .where(and(eq(agentActivity.userId, userId), gte(agentActivity.createdAt, day30)))
        .groupBy(agentActivity.agentName)
        .orderBy(sql`count(*) desc`)
        .limit(5),

      // Leads generated (30d) — uses userEmail, try matching via userId
      db.select({ value: count() }).from(leads)
        .where(gte(leads.createdAt, day30)),

      // Content generated (30d)
      db.select({ value: count() }).from(generations)
        .where(gte(generations.createdAt, day30)),

      // Current subscription
      db.select().from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1),
    ]);

    const plan = normalizePlanId(userSub[0]?.plan);
    const planDef = getPlan(plan);
    const runLimit = planDef.runsPerMonth;
    const monthlyExecutions = Number(executions30d[0]?.value ?? 0);
    const usagePercent = runLimit > 0 && runLimit < Infinity ? Math.round((monthlyExecutions / runLimit) * 100) : 0;

    return NextResponse.json({
      userId,
      plan: {
        name: plan,
        price: planDef.priceUsdCents / 100,
        runLimit,
        status: userSub[0]?.status || "active",
      },
      usage: {
        executions: {
          last24h: Number(executions24h[0]?.value ?? 0),
          last7d: Number(executions7d[0]?.value ?? 0),
          last30d: monthlyExecutions,
          allTime: Number(executionsAll[0]?.value ?? 0),
        },
        usagePercent,
        runsRemaining: runLimit >= 10_000 ? Infinity : Math.max(0, runLimit - monthlyExecutions),
        topAgents: topAgents.map((a) => ({
          name: a.agent,
          executions: Number(a.executions),
        })),
        leadsGenerated30d: Number(leadsCount[0]?.value ?? 0),
        contentGenerated30d: Number(generationsCount[0]?.value ?? 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error("Usage API error", { error: String(err) });
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
