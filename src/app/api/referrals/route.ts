import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { affiliates, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("referrals-api");

// ── Helpers ──

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SV-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isTableMissing(err: unknown): boolean {
  const pgCode = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return pgCode === "42P01" || msg.includes("does not exist");
}

// ── GET /api/referrals ──
// Returns the current user's referral code, stats, and list of referrals.
// If the user has no affiliate record, creates one automatically.

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    // Try to find existing affiliate record
    let affiliate: typeof affiliates.$inferSelect | null = null;

    try {
      const rows = await db
        .select()
        .from(affiliates)
        .where(eq(affiliates.userId, userId))
        .limit(1);

      affiliate = rows[0] ?? null;
    } catch (err) {
      if (isTableMissing(err)) {
        log.warn("affiliates table does not exist — returning empty state", { userId });
        return NextResponse.json({
          referralCode: null,
          stats: { totalReferrals: 0, totalEarnings: 0, commissionRate: 20 },
          referrals: [],
          migrationRequired: true,
        });
      }
      throw err;
    }

    // Auto-create affiliate record if none exists
    if (!affiliate) {
      let code = generateReferralCode();
      let attempts = 0;

      // Retry on collision (unlikely with SV- prefix + 6 chars)
      while (attempts < 10) {
        try {
          const inserted = await db
            .insert(affiliates)
            .values({
              userId,
              email: "", // Will be populated from Clerk metadata if available
              referralCode: code,
              commissionRate: 20,
              totalReferrals: 0,
              totalEarnings: 0,
              status: "active",
            })
            .returning();

          affiliate = inserted[0];
          break;
        } catch (insertErr) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          if (msg.includes("unique") || msg.includes("duplicate")) {
            code = generateReferralCode();
            attempts++;
            continue;
          }
          throw insertErr;
        }
      }

      if (!affiliate) {
        log.error("Failed to generate unique referral code after 10 attempts", { userId });
        return NextResponse.json(
          { error: "Failed to create referral code. Try again." },
          { status: 500 },
        );
      }

      log.info("Created affiliate record", { userId, code: affiliate.referralCode });
    }

    // Fetch referral list for this affiliate
    let referralList: (typeof referrals.$inferSelect)[] = [];
    try {
      referralList = await db
        .select()
        .from(referrals)
        .where(eq(referrals.affiliateId, affiliate.id))
        .limit(100);
    } catch (err) {
      if (isTableMissing(err)) {
        log.warn("referrals table does not exist", { userId });
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      referralCode: affiliate.referralCode,
      stats: {
        totalReferrals: affiliate.totalReferrals,
        totalEarnings: affiliate.totalEarnings, // cents
        commissionRate: affiliate.commissionRate,
      },
      referrals: referralList.map((r) => ({
        id: r.id,
        email: r.referredEmail,
        date: r.createdAt?.toISOString() ?? null,
        status: r.status,
        plan: r.plan,
        revenue: r.revenue,
        convertedAt: r.convertedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    log.error("Referrals API error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
