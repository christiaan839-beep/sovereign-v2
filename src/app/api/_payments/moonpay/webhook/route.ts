import { NextResponse } from "next/server";
import {
  getConfig,
  isTransactionCompleted,
  isTransactionFailed,
  parseExternalCustomerId,
  type WebhookEvent,
  verifyWebhookSignature,
} from "@/lib/moonpay";
import { alreadyProcessed, unmarkProcessed } from "@/lib/idempotency";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * /api/_payments/moonpay/webhook — Cook 178.
 *
 * Receives MoonPay transaction-status events. Verifies the HMAC
 * signature, dedups by transaction id, and provisions the SKU on
 * status=completed via the existing add-on-provisioner.
 *
 * Rate-limited at 240 req/min/IP — MoonPay does not perform an
 * outbound verify-call (HMAC is local) so the limit is purely
 * abuse-control, set higher than the PayPal webhook.
 */

const log = createLogger("moonpay-webhook");
const limiter = rateLimit({ interval: 60, limit: 240 });

export async function POST(req: Request) {
  if (!getConfig()) {
    return NextResponse.json(
      { error: "MoonPay not configured" },
      { status: 503 },
    );
  }

  const limited = await limiter.check(req);
  if (limited) return limited;

  const body = await req.text();
  const signatureHeader =
    req.headers.get("moonpay-signature-v2") ??
    req.headers.get("Moonpay-Signature-V2");

  const verified = verifyWebhookSignature({ body, signatureHeader });
  if (!verified) {
    log.error("MoonPay webhook signature failed");
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!event?.data?.id) {
    return NextResponse.json(
      { error: "Missing transaction id" },
      { status: 400 },
    );
  }

  if (await alreadyProcessed("moonpay:transaction", event.data.id)) {
    log.info("Duplicate MoonPay event skipped", { txId: event.data.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const parsed = parseExternalCustomerId(event.data.externalCustomerId);

  try {
    if (isTransactionCompleted(event)) {
      if (parsed?.intent === "addon") {
        const { provisionAddOn } = await import("@/lib/add-on-provisioner");
        const result = provisionAddOn({
          skuId: parsed.itemId,
          userId: parsed.userId,
          eventId: event.data.id,
        });
        log.info("MoonPay add-on provisioned", {
          txId: event.data.id,
          itemId: parsed.itemId,
          userId: parsed.userId,
          family: result.family,
        });
      } else {
        log.info("MoonPay payment completed (no provisioning hook)", {
          txId: event.data.id,
          parsed,
        });
      }
    } else if (isTransactionFailed(event)) {
      log.error("MoonPay transaction failed", {
        txId: event.data.id,
        parsed,
      });
    } else {
      log.info("MoonPay event acknowledged (no handler)", {
        txId: event.data.id,
        type: event.type,
        status: event.data.status,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // Release the marker so MoonPay's retry reprocesses (BACKLOG webhook-idempotency).
    await unmarkProcessed("moonpay:transaction", event.data.id);
    log.error("MoonPay webhook handler failed", {
      err: err instanceof Error ? err.message : String(err),
      txId: event.data.id,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
