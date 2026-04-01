import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { DRIP_SEQUENCE, sendOnboardingEmail } from "@/lib/onboarding-emails";

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
  // ── Auth ──
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  let totalSent = 0;
  let totalFailed = 0;
  const details: { day: number; sent: number; failed: number }[] = [];

  try {
    for (const step of DRIP_SEQUENCE) {
      const { dayOffset } = step;
      const stepIndex = DRIP_SEQUENCE.indexOf(step);

      // Find users whose created_at date is exactly `dayOffset` days ago
      // We compare dates (not timestamps) so the cron can run at any time of day.
      const matchingUsers = await db
        .select({ email: users.email })
        .from(users)
        .where(
          sql`date(${users.createdAt}) = date(${now.toISOString()} ::timestamp - interval '${sql.raw(String(dayOffset))} days')`
        )
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
    return NextResponse.json(
      { error: "Drip cron failed", details: String(err) },
      { status: 500 }
    );
  }
}
