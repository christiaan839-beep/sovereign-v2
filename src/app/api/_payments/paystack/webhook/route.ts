import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";
import { alreadyProcessed } from "@/lib/idempotency";
import { PLANS, type PlanId, normalizePlanId } from "@/lib/plans";
import { getInternalWebhookSecret } from "@/lib/internal-secret";
import { outboundFetch } from "@/lib/outbound-fetch";

const log = createLogger("paystack-webhook");

// Constant-time hex compare to avoid signature-leak via timing.
// Pre-Wave-72 the code used `hash !== signature` which leaks the
// first-mismatched byte position on a verified webhook receiver.
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Paystack Webhook Handler — verifies SHA512 HMAC signature,
 * logs events with persistence, triggers auto-onboard on successful payments.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    // Verify webhook signature — REJECT if secret is not configured.
    // Use 503 (transient) not 501 to avoid revealing route configuration
    // state to unauthenticated callers.
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      );
    }
    const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
    if (!timingSafeHexEqual(hash, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    // Idempotency — Paystack retries on 5xx + supports webhook replay
    // via dashboard. Without dedup, charge.success replays re-onboard
    // the user N times, sending N emails and N agent-fleet deploys.
    const eventReference = event.data?.reference || event.data?.id || event.id;
    if (eventReference) {
      if (await alreadyProcessed("paystack:event", String(eventReference))) {
        log.info("Skipped: Paystack event already processed", {
          eventReference,
        });
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // Log every event for audit (after idempotency check).
    persistAppend(
      "paystack-events",
      {
        event: event.event,
        email: event.data?.customer?.email || "",
        amount: event.data?.amount || 0,
        reference: eventReference,
        timestamp: new Date().toISOString(),
      },
      500,
    );

    const baseUrl = getPublicUrl();
    // Wave 114 H3: fail-closed read. `null` signals the env var is
    // unset/empty; senders must skip the auto-onboard call instead of
    // posting an empty header that gets silently rejected downstream.
    const internalSecret = getInternalWebhookSecret();

    switch (event.event) {
      case "charge.success": {
        const email = event.data?.customer?.email || "";
        const rawPlan = event.data?.metadata?.plan;
        const amount = Number(event.data?.amount) || 0; // Paystack returns kobo (cents)

        // Whitelist plan against canonical PLANS — never trust attacker-
        // controlled order metadata to choose the tier.
        let plan: PlanId | null = null;
        if (typeof rawPlan === "string") {
          try {
            const normalized = normalizePlanId(rawPlan);
            if (normalized !== "free") plan = normalized;
          } catch {
            plan = null;
          }
        }
        if (!plan) {
          log.warn(
            "Paystack charge.success without recognizable plan in metadata",
            { rawPlan, email, eventReference },
          );
          return NextResponse.json({ received: true });
        }

        // Validate amount against expected price (Paystack amounts are
        // in the smallest currency unit — kobo for NGN, cents for ZAR).
        const expectedCents = PLANS[plan].priceUsdCents ?? 0;
        if (
          expectedCents > 0 &&
          Math.abs(amount - expectedCents) / expectedCents > 0.5
        ) {
          log.error("Paystack amount far from expected", {
            amount,
            expectedCents,
            plan,
            eventReference,
          });
          return NextResponse.json({ received: true });
        }

        persistAppend(
          "paystack-payments",
          {
            email,
            plan,
            amount: (amount / 100).toFixed(2),
            reference: eventReference,
            timestamp: new Date().toISOString(),
          },
          1000,
        );

        // Trigger auto-onboard (best-effort) with internal-secret header.
        // Wave 114 H3: skip the call entirely when the secret is unset —
        // the receiver would reject our empty header anyway, but this
        // surfaces the misconfiguration as a single warning per process.
        if (email && internalSecret) {
          try {
            const onboardUrl = `${baseUrl}/api/_agents/auto-onboard`;
            await outboundFetch(
              onboardUrl,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-sovereign-internal-secret": internalSecret,
                },
                signal: AbortSignal.timeout(10_000),
                body: JSON.stringify({
                  clientName: event.data?.customer?.first_name || "New Client",
                  email,
                  plan,
                }),
              },
              {
                ruleId: "paystack.auto-onboard",
                allowedHosts: [new URL(onboardUrl).hostname],
              },
            );
          } catch {
            // Best-effort
          }
        }
        break;
      }

      case "subscription.create": {
        persistAppend(
          "paystack-subscriptions",
          {
            email: event.data?.customer?.email || "",
            plan_code: event.data?.plan?.plan_code || "",
            timestamp: new Date().toISOString(),
          },
          500,
        );
        break;
      }

      case "subscription.disable": {
        persistAppend(
          "paystack-cancellations",
          {
            email: event.data?.customer?.email || "",
            timestamp: new Date().toISOString(),
          },
          500,
        );
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Paystack webhook processing failed", {
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
