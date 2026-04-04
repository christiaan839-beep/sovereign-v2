import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  users,
  subscriptions,
  leads,
  generations,
  agentActivity,
} from "@/db/schema";
import { count, sql, gte, eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-analytics");

const HARDCODED_ADMINS = ["admin@sovereignmatrix.agency"];

function isAdmin(email: string): boolean {
  if (HARDCODED_ADMINS.includes(email.toLowerCase())) return true;
  const envAdmins = process.env.ADMIN_EMAILS;
  if (envAdmins) {
    const list = envAdmins.split(",").map((e) => e.trim().toLowerCase());
    if (list.includes(email.toLowerCase())) return true;
  }
  return false;
}

// MRR estimates per plan (monthly prices in USD)
const PLAN_MRR: Record<string, number> = {
  free: 0,
  array: 49,
  node: 99,
  enterprise: 299,
};

export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.primaryEmailAddress?.emailAddress) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const email = user.primaryEmailAddress.emailAddress;
    if (!isAdmin(email)) {
      log.warn(`Non-admin access attempt: ${email}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      // Revenue: subscriptions grouped by plan
      subsByPlan,
      // User metrics
      totalUsersResult,
      users7dResult,
      users30dResult,
      // Agent metrics: executions by time window
      agentExec24h,
      agentExec7d,
      agentExec30d,
      // Top 5 agents
      topAgents,
      // Lead metrics: last 30 days
      leads30dResult,
      // Content metrics: generations last 30 days
      generations30dResult,
    ] = await Promise.all([
      // ─── Revenue ──────────────────────────────────────
      db
        .select({
          plan: subscriptions.plan,
          count: count(),
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
        .groupBy(subscriptions.plan),

      // ─── Users ────────────────────────────────────────
      db.select({ value: count() }).from(users),
      db
        .select({ value: count() })
        .from(users)
        .where(gte(users.createdAt, ago7d)),
      db
        .select({ value: count() })
        .from(users)
        .where(gte(users.createdAt, ago30d)),

      // ─── Agent Activity ───────────────────────────────
      db
        .select({ value: count() })
        .from(agentActivity)
        .where(gte(agentActivity.createdAt, ago24h)),
      db
        .select({ value: count() })
        .from(agentActivity)
        .where(gte(agentActivity.createdAt, ago7d)),
      db
        .select({ value: count() })
        .from(agentActivity)
        .where(gte(agentActivity.createdAt, ago30d)),
      db
        .select({
          agentName: agentActivity.agentName,
          executions: count(),
        })
        .from(agentActivity)
        .where(gte(agentActivity.createdAt, ago30d))
        .groupBy(agentActivity.agentName)
        .orderBy(desc(sql`count(*)`))
        .limit(5),

      // ─── Leads ────────────────────────────────────────
      db
        .select({ value: count() })
        .from(leads)
        .where(gte(leads.createdAt, ago30d)),

      // ─── Generations ──────────────────────────────────
      db
        .select({ value: count() })
        .from(generations)
        .where(gte(generations.createdAt, ago30d)),
    ]);

    // Calculate MRR
    let totalMRR = 0;
    const planBreakdown: Record<string, number> = {};
    for (const row of subsByPlan) {
      const planName = row.plan ?? "free";
      const cnt = Number(row.count);
      planBreakdown[planName] = cnt;
      totalMRR += (PLAN_MRR[planName] ?? 0) * cnt;
    }

    log.info(`Admin analytics served to ${email}`);

    return NextResponse.json({
      revenue: {
        activeSubscriptionsByPlan: planBreakdown,
        estimatedMRR: totalMRR,
      },
      users: {
        total: Number(totalUsersResult[0]?.value ?? 0),
        last7Days: Number(users7dResult[0]?.value ?? 0),
        last30Days: Number(users30dResult[0]?.value ?? 0),
      },
      agents: {
        executions: {
          last24h: Number(agentExec24h[0]?.value ?? 0),
          last7d: Number(agentExec7d[0]?.value ?? 0),
          last30d: Number(agentExec30d[0]?.value ?? 0),
        },
        topAgents: topAgents.map((a) => ({
          name: a.agentName,
          executions: Number(a.executions),
        })),
      },
      leads: {
        last30Days: Number(leads30dResult[0]?.value ?? 0),
      },
      content: {
        generationsLast30Days: Number(generations30dResult[0]?.value ?? 0),
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    log.error("Admin analytics failed", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
