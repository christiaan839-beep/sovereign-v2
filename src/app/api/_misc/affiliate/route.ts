import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { affiliates, referrals } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";

const log = createLogger("affiliate");

/**
 * AFFILIATE PROGRAM API
 *
 * GET: Get affiliate dashboard (earnings, referrals, code)
 * POST: Register as affiliate or track referral
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    // Get affiliate profile
    const affiliate = await db.query.affiliates.findFirst({
      where: eq(affiliates.userId, userId),
    });

    if (!affiliate) {
      return NextResponse.json({
        registered: false,
        message: "Not registered as an affiliate. POST to register.",
      });
    }

    // Get referrals
    const refs = await db
      .select()
      .from(referrals)
      .where(eq(referrals.affiliateId, affiliate.id))
      .orderBy(desc(referrals.createdAt))
      .limit(50);

    const converted = refs.filter((r) => r.status === "converted").length;
    const pendingEarnings = refs
      .filter((r) => r.status === "converted")
      .reduce((sum, r) => sum + r.revenue, 0);

    return NextResponse.json({
      registered: true,
      referralCode: affiliate.referralCode,
      referralLink: `https://sovereignmatrix.agency/signup?ref=${affiliate.referralCode}`,
      commissionRate: affiliate.commissionRate,
      stats: {
        totalReferrals: affiliate.totalReferrals,
        converted,
        totalEarnings: affiliate.totalEarnings / 100, // dollars
        pendingEarnings: pendingEarnings / 100,
      },
      recentReferrals: refs.slice(0, 10).map((r) => ({
        email: r.referredEmail.replace(/(.{2}).*(@.*)/, "$1***$2"), // mask email
        plan: r.plan,
        status: r.status,
        revenue: r.revenue / 100,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    log.error("Affiliate GET error", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to load affiliate data" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    // Register as affiliate
    if (action === "register") {
      const existing = await db.query.affiliates.findFirst({
        where: eq(affiliates.userId, userId),
      });

      if (existing) {
        return NextResponse.json(
          { error: "Already registered", referralCode: existing.referralCode },
          { status: 409 },
        );
      }

      const email = body.email || "";
      const code =
        `${email.split("@")[0] || "user"}-${crypto.randomBytes(4).toString("hex")}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "");

      const [affiliate] = await db
        .insert(affiliates)
        .values({
          userId,
          email,
          referralCode: code,
          commissionRate: 20,
        })
        .returning();

      return NextResponse.json(
        {
          success: true,
          referralCode: affiliate.referralCode,
          referralLink: `https://sovereignmatrix.agency/signup?ref=${affiliate.referralCode}`,
          commissionRate: 20,
        },
        { status: 201 },
      );
    }

    // The "track" action used to insert referrals from the client. That path
    // is closed: referrals are now created exclusively by the Clerk webhook
    // (/api/webhooks/clerk) on user.created when ?ref= cookie is present.
    // Returning 410 Gone so any stale clients fail loudly instead of silently.
    if (action === "track") {
      return NextResponse.json(
        {
          error:
            "Action 'track' is no longer supported — referrals are created server-side by the Clerk webhook.",
        },
        { status: 410 },
      );
    }

    return NextResponse.json(
      { error: "action must be 'register'" },
      { status: 400 },
    );
  } catch (err) {
    log.error("Affiliate POST error", { error: String(err) });
    return NextResponse.json(
      { error: "Affiliate operation failed" },
      { status: 500 },
    );
  }
}
