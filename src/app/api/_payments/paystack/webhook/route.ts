import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";
import crypto from "crypto";

/**
 * Paystack Webhook Handler — Cleaned for production.
 * 
 * Verifies SHA512 HMAC signature, logs events with persistence,
 * and triggers auto-onboard on successful payments.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    // Verify webhook signature
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    if (secret) {
      const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
      if (hash !== signature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const event = JSON.parse(body);

    // Log every event for audit
    persistAppend("paystack-events", {
      event: event.event,
      email: event.data?.customer?.email || "",
      amount: event.data?.amount || 0,
      timestamp: new Date().toISOString(),
    }, 500);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    switch (event.event) {
      case "charge.success": {
        const email = event.data?.customer?.email || "";
        const plan = event.data?.metadata?.plan || "node";
        const amount = event.data?.amount || 0;

        persistAppend("paystack-payments", {
          email,
          plan,
          amount: (amount / 100).toFixed(2),
          timestamp: new Date().toISOString(),
        }, 1000);

        // Trigger auto-onboard
        if (email) {
          try {
            await fetch(`${baseUrl}/api/agents/auto-onboard`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientName: event.data?.customer?.first_name || "New Client",
                email,
                plan,
              }),
            });
          } catch {
            // Best-effort
          }
        }
        break;
      }

      case "subscription.create": {
        persistAppend("paystack-subscriptions", {
          email: event.data?.customer?.email || "",
          plan_code: event.data?.plan?.plan_code || "",
          timestamp: new Date().toISOString(),
        }, 500);
        break;
      }

      case "subscription.disable": {
        persistAppend("paystack-cancellations", {
          email: event.data?.customer?.email || "",
          timestamp: new Date().toISOString(),
        }, 500);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
