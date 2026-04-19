import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { usage, subscriptions } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { PLANS, type PlanId } from "@/lib/plans";
import { createLogger } from "@/lib/logger";

const log = createLogger("agents:billing");

/**
 * USAGE METERING & BILLING SUMMARY
 *
 * Sovereign Matrix charges flat monthly subscriptions (Stripe) — not per
 * agent-call. This route is the metering layer: it records every agent
 * invocation in the `usage` table and produces a per-user consumption
 * summary that the dashboard reads.
 *
 * Actions:
 *   - record:  POST { action: "record", agentId, tokensUsed, model }
 *              -> insert one row in `usage` for the authenticated user
 *   - summary: POST { action: "summary", since?: "30d" | "7d" | "today" }
 *              -> rollup: per-agent calls, totals, current plan + limit
 */

type Action = "record" | "summary";

function sinceDate(period: string | undefined): Date {
  const now = Date.now();
  if (period === "today") return new Date(new Date().setHours(0, 0, 0, 0));
  if (period === "7d") return new Date(now - 7 * 86_400_000);
  return new Date(now - 30 * 86_400_000); // default 30d
}

async function handleRecord(userId: string, input: Record<string, unknown>) {
  const agentId = typeof input.agentId === "string" ? input.agentId.trim() : "";
  const model = typeof input.model === "string" ? input.model.trim() : "unknown";
  const tokensUsed = Number.isFinite(input.tokensUsed) ? Number(input.tokensUsed) : 0;

  if (!agentId) {
    return { error: "agentId is required" };
  }

  try {
    await db.insert(usage).values({ userId, agentId, model, tokensUsed });
    return { success: true };
  } catch (err: unknown) {
    // Tolerate missing table in preview environments that haven't run migrations.
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      log.warn("usage table not found — run drizzle migrations", { userId });
      return { success: false, error: "usage table missing — run migrations" };
    }
    throw err;
  }
}

async function handleSummary(userId: string, input: Record<string, unknown>) {
  const since = sinceDate(typeof input.since === "string" ? input.since : undefined);

  try {
    // Per-agent rollup for this user, ordered by call count
    const rows = await db
      .select({
        agentId: usage.agentId,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usage.tokensUsed}), 0)::int`,
      })
      .from(usage)
      .where(and(eq(usage.userId, userId), gte(usage.createdAt, since)))
      .groupBy(usage.agentId);

    const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
    const totalTokens = rows.reduce((s, r) => s + r.tokens, 0);

    // Current subscription (if table exists)
    let plan = "free";
    try {
      const sub = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
      if (sub[0]?.plan) plan = sub[0].plan;
    } catch {
      // subscriptions table missing — fall back to free
    }

    const planId = (plan in PLANS ? plan : "free") as PlanId;
    const planDef = PLANS[planId];
    const planLimit = Number.isFinite(planDef.runsPerMonth) ? planDef.runsPerMonth : null;

    return {
      success: true,
      period: { since: since.toISOString(), now: new Date().toISOString() },
      plan,
      planLimit,
      totalCalls,
      totalTokens,
      utilizationPct: planLimit ? Math.round((totalCalls / planLimit) * 100) : null,
      byAgent: rows.sort((a, b) => b.calls - a.calls),
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return {
        success: false,
        error: "usage table missing — run drizzle migrations",
        byAgent: [],
        totalCalls: 0,
        totalTokens: 0,
      };
    }
    throw err;
  }
}

/** GET — public status + pricing tier list (no user data). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    billing_model: "flat monthly subscription via Stripe (USD)",
    plans: {
      free: { price_usd: 0, monthly_runs: 50 },
      starter: { price_usd: 19, monthly_runs: 500 },
      growth: { price_usd: 49, monthly_runs: 2000 },
      node: { price_usd: 199, monthly_runs: 10_000 },
      enterprise: { price_usd: 499, monthly_runs: 100_000 },
    },
    note: "Per-call charging is NOT used. See /pricing for current plans.",
  });
}

export const POST = createAgentRoute({
  name: "billing",
  handler: async ({ input }) => {
    const user = await currentUser();
    const userId = user?.id;
    if (!userId) return { error: "Authentication required" };

    const action = (input.action as Action) || "summary";
    if (action === "record") return handleRecord(userId, input);
    if (action === "summary") return handleSummary(userId, input);
    return { error: `unknown action: ${action}` };
  },
});
