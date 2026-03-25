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

// Plan limits (generations per day)
const PLAN_LIMITS: Record<string, number> = {
  sniper: 10,
  node: 100,
  array: 500,
  cartel: -1, // unlimited
};

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

  const limit = PLAN_LIMITS[plan] || 100;
  const used = todayUsage.length;
  const remaining = limit === -1 ? -1 : Math.max(0, limit - used);

  return NextResponse.json({
    userId,
    plan,
    today: {
      used,
      limit: limit === -1 ? "unlimited" : limit,
      remaining: limit === -1 ? "unlimited" : remaining,
      percentUsed: limit === -1 ? 0 : Math.round((used / limit) * 100),
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
