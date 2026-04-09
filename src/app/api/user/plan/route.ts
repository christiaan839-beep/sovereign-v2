import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkPlanLimits } from "@/lib/plan-enforcement";
import { PLANS } from "@/lib/plans";

/**
 * GET /api/user/plan — Returns current user's plan, usage, and limits.
 * Used by the dashboard usage widget and billing page.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ plan: "free", isPaid: false, limit: 50 });
    }

    const check = await checkPlanLimits(userId);
    const planDef = PLANS[check.plan];

    return NextResponse.json({
      plan: check.plan,
      planName: check.planName,
      isPaid: check.plan !== "free",
      used: check.used,
      limit: check.limit,
      remaining: check.remaining,
      priceDisplay: planDef.priceDisplayUsd,
      upgradeUrl: check.upgradeUrl || null,
    });
  } catch {
    return NextResponse.json({ plan: "free", isPaid: false, limit: 50 });
  }
}
