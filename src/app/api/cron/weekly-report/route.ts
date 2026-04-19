import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email-service";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:weekly-report");

/**
 * WEEKLY REPORT CRON — Runs every Monday at 8am.
 * Sends activity summary emails to all active users.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
import { verifyCron } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const denied = verifyCron(request);
  if (denied) return denied;

  try {
    // Get all users who ran agents this week
    const activeUsers = await db
      .select({ userId: usage.userId, runs: sql<number>`count(*)` })
      .from(usage)
      .where(sql`${usage.createdAt} > now() - interval '7 days'`)
      .groupBy(usage.userId)
      .limit(100);

    let sent = 0;
    for (const user of activeUsers) {
      if (!user.userId || !user.userId.includes("@")) continue;

      const result = await sendEmail(
        user.userId,
        "Your Weekly Sovereign Matrix Report",
        `<div style="font-family:system-ui;background:#030303;color:#fff;padding:40px;border-radius:16px;">
          <h1 style="color:#10b981;margin:0 0 16px;">Weekly Report</h1>
          <p style="color:#999;">You ran <strong style="color:#fff;">${user.runs}</strong> agent tasks this week.</p>
          <a href="https://sovereignmatrix.agency/dashboard" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#10b981;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard →</a>
        </div>`
      );
      if (result.success) sent++;
    }

    log.info(`Weekly report sent to ${sent}/${activeUsers.length} users`);
    return NextResponse.json({ success: true, sent, total: activeUsers.length });
  } catch (error) {
    log.error("Weekly report cron failed", { error: String(error) });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
