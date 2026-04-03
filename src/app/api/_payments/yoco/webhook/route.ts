import { NextResponse } from "next/server";
import { verifyYocoWebhook } from "@/lib/payments";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";

const log = createLogger("yoco-webhook");

/**
 * Yoco Webhook — Handles payment confirmations from Yoco.
 * Verifies HMAC-SHA256 signature before processing.
 */
export async function POST(req: Request) {
  const secret = process.env.YOCO_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Yoco webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("yoco-signature") || "";

  if (!verifyYocoWebhook(body, signature)) {
    log.error("Yoco webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const event = JSON.parse(body);

    if (event.type === "payment.succeeded") {
      const metadata = event.payload?.metadata || {};
      const email = metadata.email;
      const plan = metadata.plan || "node";

      if (email) {
        await db.insert(subscriptions).values({
          userId: email,
          plan,
          status: "active",
        }).onConflictDoUpdate({
          target: subscriptions.userId,
          set: { plan, status: "active", updatedAt: new Date() },
        });

        await auditLog({
          userId: email,
          action: "subscription.change",
          resource: plan,
          details: { provider: "yoco", event: event.type },
        });

        log.info("Yoco payment succeeded", { email, plan });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Yoco webhook processing failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
