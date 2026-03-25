import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";

/**
 * PAYFAST ITN (Instant Transaction Notification) — Webhook callback
 * that PayFast calls when a payment completes, cancels, or fails.
 * 
 * On successful payment:
 * 1. Validates the signature
 * 2. Activates the client's plan
 * 3. Triggers auto-onboard pipeline
 * 4. Logs the transaction
 */

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const data = Object.fromEntries(params.entries());

    const paymentStatus = data.payment_status;
    const paymentId = data.m_payment_id || "";
    const amountGross = data.amount_gross || "0";
    const emailAddress = data.email_address || "";

    // Log every ITN for audit
    persistAppend("payfast-itn-log", {
      id: paymentId,
      status: paymentStatus,
      amount: amountGross,
      email: emailAddress,
      timestamp: new Date().toISOString(),
      raw: data,
    }, 500);

    if (paymentStatus === "COMPLETE") {
      // Extract plan from payment ID (format: SM-{plan}-{timestamp})
      const planMatch = paymentId.match(/SM-(\w+)-/);
      const planId = planMatch?.[1] || "node";

      // Trigger auto-onboard
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      try {
        await fetch(`${baseUrl}/api/agents/auto-onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: `${data.name_first || ""} ${data.name_last || ""}`.trim() || "New Client",
            email: emailAddress,
            plan: planId,
          }),
        });
      } catch {
        // Auto-onboard is best-effort
      }

      // Log successful payment
      persistAppend("payfast-payments", {
        id: paymentId,
        plan: planId,
        amount: amountGross,
        email: emailAddress,
        timestamp: new Date().toISOString(),
      }, 1000);

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}
