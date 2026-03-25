import { NextResponse } from "next/server";
import { getUsageStats, getUsageLogs } from "@/lib/agent-auth";
import { requireAuth } from "@/lib/auth-guard";

/**
 * AGENT ANALYTICS API — Returns usage statistics for the analytics dashboard.
 */

export async function GET() {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const stats = getUsageStats();
  const recentLogs = getUsageLogs().slice(-50).reverse();

  return NextResponse.json({
    status: "Analytics Engine — Active",
    ...stats,
    recent_activity: recentLogs,
  });
}
