import { NextResponse } from "next/server";
import { getSignalStats } from "@/lib/agent-memory";
import { createLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/cron-auth";

const log = createLogger("cron:daily-digest");

/**
 * DAILY DIGEST CRON — Runs every day at 7am.
 * Cleans up stale data and generates platform-wide stats.
 */
export async function GET(request: Request) {
  const authErr = requireCronAuth(request);
  if (authErr) return authErr;

  try {
    const signals = getSignalStats();

    log.info("Daily digest generated", {
      totalSignals: signals.totalSignals,
      lastDay: signals.lastDay,
      activeSubscriptions: signals.activeSubscriptions,
    });

    return NextResponse.json({
      success: true,
      digest: {
        date: new Date().toISOString().split("T")[0],
        signals,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error("Daily digest cron failed", { error: String(error) });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
