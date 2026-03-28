import { NextResponse } from "next/server";
import { guardRoute, errorResponse } from "@/lib/api-guard";
import { applyReferral } from "@/lib/referral-system";

export async function POST(req: Request) {
  const guard = await guardRoute();
  if (!guard.authorized) return guard.response;

  let body: { referralCode?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  const { referralCode } = body;
  if (!referralCode || typeof referralCode !== "string") {
    return errorResponse("Missing referralCode", 400, "MISSING_FIELD");
  }

  const result = applyReferral(guard.userId, referralCode);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    bonusRuns: result.bonusRuns,
  });
}
