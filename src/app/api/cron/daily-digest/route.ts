import { NextResponse } from "next/server";
import { getSignalStats } from "@/lib/agent-memory";
import { createLogger } from "@/lib/logger";
import { verifyCron } from "@/lib/cron-auth";

const log = createLogger("cron:daily-digest");

/**
 * DAILY DIGEST CRON — Runs every day at 7am.
 * Cleans up stale data and generates platform-wide stats.
 *
 * Round 25 — was using string-compare `===` with no timing-safe
 * compare AND no fail-closed if CRON_SECRET unset. Replaced with the
 * canonical `verifyCron(request)` helper so this can never be the
 * weak link in the cron-auth perimeter.
 */
export async function GET(request: Request) {
  const cronErr = verifyCron(request);
  if (cronErr) return cronErr;

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
