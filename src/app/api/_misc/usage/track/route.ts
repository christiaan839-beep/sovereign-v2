import { NextResponse } from "next/server";
import { persistRead, persistAppend } from "@/lib/persist";

/**
 * USAGE METERING API — Tracks AI generations per user.
 *
 * GET: Returns current usage stats for the authenticated user
 * POST: Logs a new generation event
 */

interface UsageEvent {
  agentId: string;
  userId: string;
  timestamp: string;
  tokens: number;
}

import { getPlan, normalizePlanId } from "@/lib/plans";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "anonymous";
  const plan = searchParams.get("plan") || "node";

  const allUsage = persistRead<UsageEvent[]>("usage-events", []);

  // Filter to this user's usage today
  const today = new Date().toISOString().split("T")[0];
  const todayUsage = allUsage.filter(
    (e) => e.userId === userId && e.timestamp.startsWith(today)
  );

  const planId = normalizePlanId(plan);
  const limit = getPlan(planId).runsPerMonth;
  const used = todayUsage.length;
  const isUnlimited = limit >= 10_000;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);

  return NextResponse.json({
    userId,
    plan: planId,
    today: {
      used,
      limit: isUnlimited ? "unlimited" : limit,
      remaining: isUnlimited ? "unlimited" : remaining,
      percentUsed: isUnlimited ? 0 : Math.round((used / limit) * 100),
    },
    totalAllTime: allUsage.filter((e) => e.userId === userId).length,
  });
}

export async function POST(req: Request) {
  try {
    const { agentId, userId, tokens } = await req.json();

    if (!agentId || !userId) {
      return NextResponse.json(
        { error: "agentId and userId are required" },
        { status: 400 }
      );
    }

    const event: UsageEvent = {
      agentId,
      userId,
      timestamp: new Date().toISOString(),
      tokens: tokens || 0,
    };

    persistAppend("usage-events", event);

    // Also log to agent-activity for analytics
    persistAppend("agent-activity", {
      agent: agentId,
      action: "generation",
      timestamp: event.timestamp,
      userId,
    });

    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json(
      { error: "Failed to track usage" },
      { status: 500 }
    );
  }
}
