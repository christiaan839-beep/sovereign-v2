import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/credits";
import { getPlan } from "@/lib/plans";
import { getUserTier } from "@/lib/free-tier";

/**
 * GET /api/credits/balance
 *
 * Returns the signed-in user's current credit balance in cents, their
 * current plan tier, and the monthly allocation that plan grants.
 *
 * The CreditsWidget polls this every 30 seconds — keep it cheap.
 * One SELECT from user_credits, one tier read, no aggregates.
 *
 * Response shape:
 *   { balanceCents, plan, monthlyAllocationCents, lowBalance }
 *
 * lowBalance = true when balance < $1 (100 cents). UI uses this to show
 * a copper "Top up" nudge in the sidebar widget.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balanceCents, plan] = await Promise.all([
    getBalance(userId),
    getUserTier(userId),
  ]);
  const planDef = getPlan(plan);

  return NextResponse.json({
    balanceCents,
    plan,
    monthlyAllocationCents: planDef.monthlyCreditsCents,
    lowBalance: balanceCents < 100,
  });
}
