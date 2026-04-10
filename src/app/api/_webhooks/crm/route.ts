import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("crm-webhook");

/**
 * SOVEREIGN MATRIX CRM WEBHOOK LAYER
 *
 * Receives state changes directly from HubSpot and Salesforce.
 * E.g., When a human sales rep moves a Deal to "Closed Won", this webhook triggers
 * the autonomous agent swarm to generate contracts and onboard the client via email.
 *
 * SECURITY: Requires HubSpot HMAC-SHA256 v3 signature verification. Without
 * the configured HUBSPOT_CLIENT_SECRET env var the endpoint returns 503 —
 * we never silently accept unauthenticated webhooks (they could be used to
 * trigger autonomous agent swarms and burn LLM costs / leak data).
 *
 * HubSpot signature docs:
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */

const limiter = rateLimit({ interval: 60, limit: 30 });

/**
 * Verify HubSpot v3 webhook signature.
 * v3 = base64(HMAC-SHA256(secret, METHOD + URL + BODY + TIMESTAMP))
 */
function verifyHubSpotSignature(
  signature: string,
  secret: string,
  method: string,
  url: string,
  body: string,
  timestamp: string,
): boolean {
  // Reject stale requests (replay protection) — HubSpot recommends 5 min.
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  if (ageMs > 5 * 60 * 1000 || ageMs < -30 * 1000) return false;

  const source = `${method}${url}${body}${timestamp}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(source)
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) {
    log.error("HUBSPOT_CLIENT_SECRET not configured — rejecting webhook");
    return NextResponse.json(
      { error: "CRM webhook not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: "Missing signature headers" },
      { status: 401 },
    );
  }

  // Read raw body for signature verification — req.json() would consume it.
  const rawBody = await req.text();

  if (
    !verifyHubSpotSignature(
      signature,
      secret,
      "POST",
      req.url,
      rawBody,
      timestamp,
    )
  ) {
    log.error("Invalid HubSpot signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const _payload = JSON.parse(rawBody);
    // TODO: wire up agent swarm trigger (contract gen + onboarding email).
    return NextResponse.json({
      success: true,
      status: "CRM State Logged by Sovereign Matrix",
    });
  } catch (error) {
    log.error("CRM webhook parsing error", error as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to parse CRM state mutation" },
      { status: 400 },
    );
  }
}
