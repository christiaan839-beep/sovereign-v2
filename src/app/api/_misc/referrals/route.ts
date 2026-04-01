import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("referrals");

/**
 * GET — Return the current user's referral stats.
 * Referral code = first 8 chars of userId.
 * Bonus runs = count of negative-token "referral-bonus" rows in usage table.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const referralCode = userId.slice(0, 8);
    const referralLink = `https://sovereignmatrix.agency/onboarding?ref=${referralCode}`;

    // Count bonus runs earned (referral-bonus rows have negative tokensUsed)
    let bonusRuns = 0;
    let totalReferred = 0;
    try {
      const bonusResult = await db
        .select({ total: sql<number>`COALESCE(SUM(ABS(tokens_used)), 0)::int` })
        .from(usage)
        .where(and(eq(usage.userId, userId), eq(usage.agentId, "referral-bonus")));
      bonusRuns = bonusResult[0]?.total ?? 0;
      totalReferred = Math.floor(bonusRuns / 50); // 50 bonus runs per referral
    } catch {
      log.warn("Could not fetch referral stats from DB");
    }

    return NextResponse.json({
      referralCode,
      referralLink,
      totalReferred,
      bonusRuns,
      bonusPerReferral: 50,
    });
  } catch (err) {
    log.error("Referral stats error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to load referral data" }, { status: 500 });
  }
}
