/**
 * COINBASE COMMERCE — accept crypto without running a wallet.
 *
 * Why this and not direct on-chain wallet integration:
 *
 *   - Sovereign sells SaaS subscriptions, not blockchain primitives.
 *     For the buyer the value is "I paid in USDC and got Pro"; what
 *     they don't want is a Web3 onboarding flow gating their auth.
 *   - Coinbase Commerce is the lowest-friction "accept crypto" stack:
 *     hosted checkout, settles to USD or BTC, supports BTC/ETH/USDC/
 *     LTC/DAI/DOGE/SHIB out of the box, webhooks the result with a
 *     HMAC-SHA256 signature.
 *   - Self-custody (direct USDC on Base, wallet-pays-contract) is
 *     documented in docs/crypto-payments.md as the "level 2" path for
 *     callers who want zero-trust settlement. We don't need it for v2.
 *
 * Centralized vs decentralized framing for the buyer:
 *
 *   - **Card / EFT** (Stripe / PayFast / Paystack) — fully centralized.
 *     Buyer trusts Stripe; the wire is fiat.
 *   - **Hosted crypto** (this file, Coinbase Commerce) — *hybrid*.
 *     Buyer pays in crypto (decentralized asset, on-chain settlement),
 *     but routes through Coinbase as the merchant processor. Buyer
 *     trusts no card network, but trusts Coinbase's webhook.
 *   - **Self-custody crypto** (future, docs only) — fully decentralized.
 *     Buyer sends USDC directly to our merchant address on Base; we
 *     verify on-chain via a confirmed-transaction check. No middleman.
 *
 * The pricing page surfaces all three when configured: callers pick
 * the trust-model that matches their threat tolerance.
 *
 * Threat model for Coinbase Commerce:
 *
 *   - The X-CC-Webhook-Signature header is HMAC-SHA256 over the raw
 *     request body using `COINBASE_COMMERCE_WEBHOOK_SECRET`. We MUST
 *     verify before trusting any event — without verification, anyone
 *     who knows our endpoint URL can forge a "charge:confirmed".
 *   - We additionally idempotency-gate by event.id so a retried event
 *     can't double-credit a subscription.
 *   - Coinbase Commerce can occasionally fire two "confirmed" events
 *     for the same charge (block reorg). The idempotency key dedups.
 *
 * Charge lifecycle:
 *
 *   1. App POSTs to /charges to create a hosted-checkout URL.
 *   2. Buyer pays in their wallet; Coinbase watches the chain.
 *   3. Coinbase fires `charge:created` → `charge:pending` → either
 *      `charge:confirmed` (success) or `charge:failed`/`charge:expired`.
 *   4. We act ONLY on `charge:confirmed` — pending is informational.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("coinbase-commerce");

const COINBASE_COMMERCE_API = "https://api.commerce.coinbase.com";

export interface CommerceChargeInput {
  /** Human-friendly charge name shown on hosted checkout. */
  name: string;
  /** Longer description shown on hosted checkout. */
  description: string;
  /** Amount in major units (e.g., "49.00" for $49). */
  amount: string;
  /** ISO 4217 currency code (USD recommended; settle preference set in Commerce dashboard). */
  currency: string;
  /** Echoed back verbatim on the webhook — use this to bind to userId/plan. */
  metadata: Record<string, string>;
  /** Where to bounce the buyer after success. */
  redirectUrl?: string;
  /** Where to bounce the buyer if they hit "cancel". */
  cancelUrl?: string;
}

export interface CommerceChargeResponse {
  id: string;
  code: string;
  hosted_url: string;
  status: string;
  pricing_type: string;
  metadata: Record<string, string>;
}

/**
 * Create a Coinbase Commerce charge and return the hosted-checkout URL.
 *
 * Returns `null` if `COINBASE_COMMERCE_API_KEY` is not configured — the
 * caller should treat this as "crypto payment unavailable" and surface
 * a 503 with setup instructions.
 */
export async function createCommerceCharge(
  input: CommerceChargeInput,
): Promise<CommerceChargeResponse | null> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) {
    log.warn("COINBASE_COMMERCE_API_KEY not set — crypto checkout disabled");
    return null;
  }

  const body = {
    name: input.name,
    description: input.description,
    pricing_type: "fixed_price",
    local_price: { amount: input.amount, currency: input.currency },
    metadata: input.metadata,
    redirect_url: input.redirectUrl,
    cancel_url: input.cancelUrl,
  };

  const res = await fetch(`${COINBASE_COMMERCE_API}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    log.error("Coinbase Commerce charge creation failed", {
      status: res.status,
      body: text.slice(0, 500),
    });
    throw new Error(`Coinbase Commerce API ${res.status}`);
  }

  const json = (await res.json()) as { data: CommerceChargeResponse };
  return json.data;
}

/**
 * Verify the X-CC-Webhook-Signature header against the raw request body
 * using `COINBASE_COMMERCE_WEBHOOK_SECRET`.
 *
 * MUST be called with the raw body (text-decoded), not the parsed JSON
 * — JSON.stringify reorders keys and breaks the signature.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyCommerceWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  // SHA-256 hex is always 64 chars. Reject anything else BEFORE
  // allocating a Buffer — a 10MB hex header would otherwise allocate
  // a 5MB Buffer (pre-auth DoS surface). Also catches obvious garbage
  // (empty string, malformed input) without needing a try/catch.
  if (signatureHeader.length !== 64) return false;
  if (!/^[0-9a-f]{64}$/i.test(signatureHeader)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Refetch a charge by id using our merchant API key. The webhook handler
 * uses this to confirm the charge was created by US (not an attacker
 * who somehow obtained our webhook secret and tries to forge a payload
 * referencing a charge created on their own merchant account).
 *
 * Returns null if the charge isn't accessible — caller should treat as
 * "do not honor". Distinct from a network error: a 404 here is a hard
 * signal the webhook is forged.
 */
export async function fetchCommerceCharge(
  chargeId: string,
): Promise<CommerceChargeResponse | null> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey || !chargeId) return null;

  const res = await fetch(`${COINBASE_COMMERCE_API}/charges/${chargeId}`, {
    method: "GET",
    headers: {
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": "2018-03-22",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    log.error("Coinbase Commerce charge refetch failed", {
      status: res.status,
      chargeId,
    });
    return null;
  }

  const json = (await res.json()) as { data: CommerceChargeResponse };
  return json.data;
}

/**
 * Minimal typed shape of a Coinbase Commerce webhook event. The full
 * payload has many more fields; we only consume what we trust.
 */
export interface CommerceWebhookEvent {
  id: string;
  type:
    | "charge:created"
    | "charge:confirmed"
    | "charge:failed"
    | "charge:delayed"
    | "charge:pending"
    | "charge:resolved";
  data: {
    id: string;
    code: string;
    metadata: Record<string, string>;
    pricing: { local: { amount: string; currency: string } };
    timeline: Array<{ time: string; status: string }>;
  };
}
