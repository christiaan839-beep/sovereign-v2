import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Returns the current user's plan tier.
 * Used by useUsage hook to determine generation limits.
 *
 * Sweep 4 fix — was checking `plan === "pro" || "agency"` which were
 * legacy IDs that don't exist in plans.ts (canonical: free / starter
 * / founder / array / node / enterprise / pay_per_run). The check
 * now derives `isPaid` from the canonical plan record's price.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const email = auth.email || "admin@umbra.ai";

    const [tenant] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.clerkUserId, email))
      .limit(1);

    const planId = (tenant?.plan as PlanId) || "free";
    // A plan is "paid" if its base monthly price is non-zero. Pulling
    // from the canonical PLANS map means new tiers get classified
    // automatically without code changes here.
    const planRecord = PLANS[planId] ?? PLANS.free;
    const isPaid = planRecord.priceUsdCents > 0;
    const limit =
      planRecord.runsPerMonth === Infinity ? 999999 : planRecord.runsPerMonth;

    return NextResponse.json({
      plan: planId,
      isPaid,
      limit,
    });
  } catch {
    return NextResponse.json({ plan: "free", isPaid: false, limit: 50 });
  }
}
