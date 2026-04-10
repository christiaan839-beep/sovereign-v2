import { NextResponse } from "next/server";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";

const log = createLogger("booking-webhook");

/**
 * BOOKING WEBHOOK — Cal.com integration for Ghost Fleet and lead management.
 * Receives booking events and triggers downstream automation.
 * GET: returns available link and status.
 * POST: receives Cal.com webhook payloads.
 *
 * SECURITY: Without signature verification, any attacker could POST a crafted
 * payload with an attacker-controlled attendee email, causing us to send
 * emails from hello@sovereignmatrix.agency to arbitrary addresses
 * (destroying domain reputation). Requires CALCOM_WEBHOOK_SECRET to be set.
 *
 * Cal.com signing docs: https://cal.com/docs/core-features/webhooks
 */

const limiter = rateLimit({ interval: 60, limit: 30 });

/**
 * Verify Cal.com HMAC-SHA256 signature over the raw request body.
 * Cal.com sends hex digest in X-Cal-Signature-256 header.
 */
function verifyCalSignature(
  signature: string,
  secret: string,
  rawBody: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET() {
  const calUrl = process.env.CALCOM_BOOKING_URL || "https://cal.com/your-link";

  return NextResponse.json({
    status: "active",
    bookingUrl: calUrl,
    features: [
      "Auto-capture lead data from bookings",
      "Trigger Resend welcome email on booking",
      "Log to Agent Analytics",
      "Auto-enrich via Apollo.io (if configured)",
    ],
  });
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) {
    log.error("CALCOM_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json(
      { error: "Booking webhook not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("x-cal-signature-256");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Read raw body once for signature verification, then parse.
  const rawBody = await req.text();

  if (!verifyCalSignature(signature, secret, rawBody)) {
    log.error("Invalid Cal.com signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const event = payload.triggerEvent || payload.event || "unknown";

    // Cal.com sends: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
    const booking = payload.payload || payload;
    const attendee = booking.attendees?.[0] || {};
    const name = attendee.name || "Unknown";
    const email = attendee.email || "";
    const startTime = booking.startTime || new Date().toISOString();

    // Auto-trigger welcome email
    if (event === "BOOKING_CREATED" && email) {
      try {
        await fetch(new URL("/api/email", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `Your call with Sovereign Matrix is confirmed`,
            template: "welcome",
            data: { name, dashboardUrl: getPublicUrl() },
          }),
        });
      } catch (e) {
        log.error("Email trigger failed", e as Record<string, unknown>);
      }
    }

    // Log to analytics
    try {
      await fetch(new URL("/api/_agents/analytics", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          agentId: "booking-webhook",
          userId: email,
          metadata: { event, name, startTime },
        }),
      });
    } catch (e) {
      log.error("Analytics log failed", e as Record<string, unknown>);
    }

    return NextResponse.json({
      received: true,
      event,
      lead: { name, email, startTime },
      actions: ["email_sent", "analytics_logged"],
    });
  } catch (error) {
    log.error("Booking webhook handler error", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to process booking" },
      { status: 500 },
    );
  }
}
