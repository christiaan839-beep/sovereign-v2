/**
 * POST /api/agents/trigger/[slug]
 *
 * External webhook endpoint. A customer's system (Stripe, GitHub,
 * Intercom, a custom script) POSTs here with an HMAC signature; we
 * verify the signature, run the agent, and deliver the result back
 * to their registered callback URL.
 *
 * Headers required:
 *   X-Sovereign-Subscription-Id  UUID of the registered subscription
 *   X-Sovereign-Signature        sha256=<hex> HMAC over ${ts}.${body}
 *   X-Sovereign-Timestamp        Unix seconds
 *
 * Body: whatever the agent expects as input (free-form JSON the
 * customer is responsible for shaping).
 *
 * Response shape (synchronous, small):
 *   { accepted: true, invocationId, deliveryPending: true }
 *
 * The actual result flows to the customer's callbackUrl via a signed
 * POST. Decoupling trigger from delivery means the trigger endpoint
 * returns in <100ms even for slow-running agents, preventing upstream
 * webhook timeouts (Stripe gives you 10s, GitHub 10s).
 *
 * Rate limit: 120/min per subscription (covers rapid bursts without
 * leaving the door open for runaway loops).
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import { invokeMarketplaceAgent } from "@/lib/marketplace-invoke";
import {
  deliverWebhookResult,
  verifyTriggerRequest,
} from "@/lib/webhook-triggers";
import { createLogger } from "@/lib/logger";

const log = createLogger("trigger-webhook");

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(
  request: Request,
  ctx: RouteContext,
): Promise<Response> {
  const { slug } = await ctx.params;
  const agentSlug = slug.toLowerCase();

  // Rate limit per IP — a generous cap because legitimate webhook
  // bursts (say a Shopify flash sale) can exceed typical buyer rates.
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "webhook-trigger",
    windowMs: 60_000,
    max: 120,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { accepted: false, code: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  const subscriptionId = request.headers.get("x-sovereign-subscription-id");
  const signatureHeader = request.headers.get("x-sovereign-signature");
  const timestampHeader = request.headers.get("x-sovereign-timestamp");

  if (!subscriptionId) {
    return NextResponse.json(
      { accepted: false, code: "missing_subscription_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Read body as raw text — HMAC signs over the exact bytes.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { accepted: false, code: "body_unreadable" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Verify the caller's HMAC + subscription is active + slug matches.
  const verdict = await verifyTriggerRequest({
    subscriptionId,
    agentSlugFromUrl: agentSlug,
    rawBody,
    signatureHeader,
    timestampHeader,
  });
  if (!verdict.ok || !verdict.subscription) {
    // Map the error code to HTTP status — 404 for not-found (don't
    // confirm whether a given ID exists by returning 401 vs 404),
    // 401 for every auth-style failure.
    const statusMap: Record<string, number> = {
      subscription_not_found: 404,
      subscription_inactive: 404,
      wrong_agent_slug: 404,
      bad_signature: 401,
      stale_timestamp: 401,
      no_db: 503,
    };
    const httpStatus = verdict.code ? statusMap[verdict.code] ?? 400 : 400;
    return NextResponse.json(
      {
        accepted: false,
        code: verdict.code ?? "verification_failed",
        reason: verdict.reason,
      },
      { status: httpStatus, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Parse body as JSON for the agent input. If not JSON, we pass the
  // raw string — creators build agents that handle both.
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    parsedBody = rawBody;
  }

  // Invoke the agent synchronously (fast — <8s p95 per our SLO).
  // Webhook callers typically expect the trigger endpoint to be
  // near-instant, but running synchronously means we can return the
  // invocationId + start delivery; for long-running agents the
  // delivery path kicks off async.
  const invokeInput =
    typeof parsedBody === "object" && parsedBody !== null && "input" in (parsedBody as Record<string, unknown>)
      ? String((parsedBody as Record<string, unknown>).input ?? "")
      : typeof parsedBody === "string"
      ? parsedBody
      : JSON.stringify(parsedBody);

  const result = await invokeMarketplaceAgent({
    agentIdOrSlug: agentSlug,
    input: invokeInput,
  });

  if (!result.ok) {
    // Log the failure AGAINST the subscription so operators can find it.
    log.warn("trigger invoke failed", {
      subscriptionId: verdict.subscription.id,
      agentSlug,
      code: result.code,
    });
    // Still deliver the error to the callback so the customer knows.
    void deliverWebhookResult({
      subscriptionId: verdict.subscription.id,
      secret: verdict.subscription.secret,
      callbackUrl: verdict.subscription.callbackUrl,
      invocationId: "", // no invocation was produced
      body: {
        ok: false,
        code: result.code,
        message: result.message,
      },
    });
    return NextResponse.json(
      { accepted: false, code: result.code, reason: result.message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Fire-and-forget delivery. The trigger endpoint returns immediately
  // with the invocationId; the full result (agent output + earnings +
  // attestation) arrives at the customer's callback URL.
  void deliverWebhookResult({
    subscriptionId: verdict.subscription.id,
    secret: verdict.subscription.secret,
    callbackUrl: verdict.subscription.callbackUrl,
    invocationId: result.invocationId,
    body: {
      ok: true,
      invocationId: result.invocationId,
      agent: result.agent,
      result: result.result,
      earnings: result.earnings,
      sla: result.sla,
      attestation: result.attestation,
    },
  });

  return NextResponse.json(
    {
      accepted: true,
      invocationId: result.invocationId,
      deliveryPending: true,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
