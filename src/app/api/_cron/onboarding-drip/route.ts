import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { DRIP_SEQUENCE, sendOnboardingEmail } from "@/lib/onboarding-emails";
import { requireCronAuth } from "@/lib/cron-auth";

const log = createLogger("onboarding-drip");

/**
 * Onboarding Drip Cron
 *
 * Runs daily (e.g., via Vercel Cron at 09:00 UTC).
 * For each drip step, finds users who signed up exactly N days ago
 * and sends the corresponding email.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  // ── Auth — fails CLOSED: rejects when CRON_SECRET is unset ──
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const now = new Date();
  let totalSent = 0;
  let totalFailed = 0;
  const details: { day: number; sent: number; failed: number }[] = [];

  try {
    for (const step of DRIP_SEQUENCE) {
      const { dayOffset } = step;
      const stepIndex = DRIP_SEQUENCE.indexOf(step);

      // Find users who signed up exactly `dayOffset` days ago
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - dayOffset);
      const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const matchingUsers = await db
        .select({ email: users.email })
        .from(users)
        .where(sql`date(${users.createdAt}) = ${dateStr}`)
        .limit(500);

      let sent = 0;
      let failed = 0;

      for (const user of matchingUsers) {
        const ok = await sendOnboardingEmail(user.email, stepIndex);
        if (ok) {
          sent++;
        } else {
          failed++;
        }
      }

      if (matchingUsers.length > 0) {
        log.info("Drip step processed", {
          day: dayOffset,
          matched: matchingUsers.length,
          sent,
          failed,
        });
      }

      totalSent += sent;
      totalFailed += failed;
      details.push({ day: dayOffset, sent, failed });
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      totalSent,
      totalFailed,
      details,
    });
  } catch (err) {
    log.error("Onboarding drip cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
