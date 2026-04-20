import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("legacy-payments");

/**
 * LEGACY PAYMENT GUARD — closes the door on new PayFast/Yoco/Paystack
 * signups while leaving webhooks functional for existing subscribers.
 *
 * Context: Sovereign Matrix consolidated to USD-only Stripe billing.
 * Dual-currency ZAR pricing fragmented accounting + confused global
 * buyers. We disable NEW checkouts but keep WEBHOOK endpoints alive
 * so existing South African subscribers can still receive
 * payment/cancel events until they're migrated to Stripe.
 *
 * Env flag: LEGACY_PAYMENT_PROVIDERS=1 enables legacy checkout flows
 * (use only for explicit migration cutovers).
 *
 * What this gates:
 *   - New checkout requests → 410 Gone with migration instructions
 *   - Webhook endpoints → always functional (receives events for
 *     existing subscribers; processors are idempotent so repeat
 *     deliveries don't cause drift)
 */

export function guardLegacyCheckout(provider: "payfast" | "yoco" | "paystack"): Response | null {
  if (process.env.LEGACY_PAYMENT_PROVIDERS === "1") {
    return null; // explicit override for admin-triggered cutovers
  }
  log.warn("legacy checkout blocked", { provider });
  return NextResponse.json(
    {
      error: "Legacy payment provider",
      code: "LEGACY_PROVIDER_DISABLED",
      message:
        `${provider} checkout has been retired. Sovereign Matrix now bills in USD via Stripe only. ` +
        "Existing subscribers continue to be serviced via their webhook; new signups must use Stripe.",
      migrate: "https://sovereignmatrix.agency/pricing",
    },
    { status: 410 },
  );
}
