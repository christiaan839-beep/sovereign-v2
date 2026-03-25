import { NextResponse } from "next/server";

/**
 * Paystack Callback — handles redirect after payment.
 * Verifies the transaction via Paystack API and redirects to dashboard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(new URL("/dashboard/billing?payment=failed", req.url));
  }

  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.redirect(new URL("/dashboard?payment=success", req.url));
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = await res.json();

    if (data?.data?.status === "success") {
      return NextResponse.redirect(new URL("/dashboard?payment=success", req.url));
    }

    return NextResponse.redirect(new URL("/dashboard/billing?payment=failed", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/billing?payment=error", req.url));
  }
}
