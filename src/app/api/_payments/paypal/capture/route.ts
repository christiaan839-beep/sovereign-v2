import { NextResponse } from "next/server";
import { captureOrder, getConfig } from "@/lib/paypal";
import { getPublicUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";

/**
 * /api/_payments/paypal/capture — PayPal Orders v2 return handler.
 *
 * PayPal redirects the buyer's browser here after approval, appending
 * ?token=<orderId>. We capture the order server-side; PayPal then fires
 * PAYMENT.CAPTURE.COMPLETED, which the webhook turns into a subscription
 * (activatePlanSubscription). We redirect into the dashboard success modal.
 *
 * Without this step an Orders-v2 order is created and approved but never
 * captured — no money is taken and the provisioning webhook never fires.
 */

const log = createLogger("paypal-capture");

function redirect(to: string): NextResponse {
  return NextResponse.redirect(`${getPublicUrl()}${to}`, { status: 303 });
}

export async function GET(req: Request) {
  if (!getConfig()) return redirect("/pricing?paypal=error");

  const orderId = new URL(req.url).searchParams.get("token");
  if (!orderId) return redirect("/pricing?paypal=error");

  try {
    const { status, customId } = await captureOrder(orderId);
    if (status !== "COMPLETED") {
      log.warn("PayPal capture not completed", { orderId, status });
      return redirect("/pricing?paypal=cancelled");
    }

    // customId is "<intent>:<itemId>:<userId>" — reuse the plan id so the
    // dashboard CheckoutSuccess modal (?checkout=success&plan=) can greet the
    // buyer. Provisioning itself is the webhook's job (idempotent).
    const [intent, itemId] = (customId ?? "").split(":");
    log.info("PayPal order captured", { orderId, intent, itemId });

    if (intent === "plan" && itemId) {
      return redirect(
        `/dashboard?checkout=success&plan=${encodeURIComponent(itemId)}`,
      );
    }
    return redirect(`/dashboard?checkout=success`);
  } catch (err) {
    log.error("PayPal capture failed", {
      orderId,
      err: err instanceof Error ? err.message : String(err),
    });
    return redirect("/pricing?paypal=error");
  }
}
