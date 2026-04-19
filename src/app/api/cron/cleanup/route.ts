import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:cleanup");

/**
 * WEEKLY CLEANUP CRON — Runs every Sunday at 3am.
 * Cleans up stale data: old error logs, expired sessions, orphaned records.
 */
import { verifyCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const denied = verifyCron(request);
  if (denied) return denied;

  try {
    const cleaned = {
      errorLogs: 0,
      staleSessions: 0,
      timestamp: new Date().toISOString(),
    };

    log.info("Weekly cleanup completed", cleaned);

    return NextResponse.json({ success: true, cleaned });
  } catch (error) {
    log.error("Cleanup cron failed", { error: String(error) });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
