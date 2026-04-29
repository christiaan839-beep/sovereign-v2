/**
 * WEBHOOK SIGNING + VERIFICATION (R58).
 *
 * Closes the outbound cryptographic perimeter. Every webhook event
 * Sovereign emits is Ed25519-signed; receivers can verify offline
 * with a published platform public key. Same trustless pattern as
 * R34/R37/R44 — applied at the EDGE.
 *
 * THE TRUST CONTRACT:
 *
 *   1. Sovereign emits webhook → POSTs body + signed headers to
 *      customer's URL.
 *   2. Headers include:
 *      - X-Sovereign-Signature: base64url Ed25519 signature
 *      - X-Sovereign-Signature-Timestamp: RFC 3339 timestamp
 *      - X-Sovereign-Signature-Key-Id: identifier of the platform
 *        public key (rotatable)
 *      - X-Sovereign-Webhook-Id: unique event id (replay protection)
 *   3. Receiver reconstructs the canonical message:
 *        timestamp\n
 *        webhook_id\n
 *        sha256(body)\n
 *      and verifies signature against the platform public key.
 *   4. Receiver checks: timestamp is within freshness window
 *      (default 5 minutes), webhook_id has not been processed
 *      before (replay defense).
 *
 * Why this matters for $100K+ deals:
 *   - Stripe-shape webhook verification is table-stakes for
 *     enterprise procurement
 *   - Without it: customers must trust IP-based filtering, which
 *     fails the moment they're behind a proxy / load balancer
 *   - With it: webhooks become EVIDENCE-GRADE — a legal team can
 *     prove "this notification came from Sovereign at this time"
 *     years later
 *
 * Pure-function design throughout. signWebhookPayload requires the
 * private key (impure), but the canonical message construction +
 * verification are pure and port verbatim to @sovereign/inspector.
 */

import { createHash } from "node:crypto";
import { signMessage, verifySignature } from "@/lib/agent-delegation";

// ── Types ──────────────────────────────────────────────────────────

export interface WebhookHeaders {
  "X-Sovereign-Signature": string;
  "X-Sovereign-Signature-Timestamp": string;
  "X-Sovereign-Signature-Key-Id": string;
  "X-Sovereign-Webhook-Id": string;
}

export interface SignedWebhook {
  body: string;
  headers: WebhookHeaders;
}

// ── Pure: canonical message construction ───────────────────────────

/**
 * Pure: build the canonical webhook message that's signed.
 *
 * Format (line-separated, deterministic):
 *   v1
 *   sovereign-webhook
 *   timestamp:{iso}
 *   webhookId:{uuid}
 *   bodyHash:{sha256-hex}
 *
 * Same key-order-deterministic pattern as R34/R37/R38/R44.
 *
 * Includes the body's sha256 (NOT the body itself) so the signature
 * is bounded in size regardless of body. Receivers recompute the
 * sha256 from the raw body they got.
 */
export function buildWebhookCanonicalMessage(input: {
  timestamp: string;
  webhookId: string;
  body: string;
}): string {
  const bodyHash = createHash("sha256").update(input.body).digest("hex");
  return [
    "v1",
    "sovereign-webhook",
    `timestamp:${input.timestamp}`,
    `webhookId:${input.webhookId}`,
    `bodyHash:${bodyHash}`,
  ].join("\n");
}

// ── Sign (impure — needs private key) ──────────────────────────────

export interface SignWebhookInput {
  body: string;
  webhookId: string;
  timestamp: string;
  platformPrivateKey: string;
  platformKeyId: string;
}

/**
 * Sign a webhook payload. Returns the headers a webhook emitter
 * should attach.
 *
 * `timestamp` is caller-supplied for testability + clock-skew
 * mitigation; production callers pass `new Date().toISOString()`.
 */
export function signWebhook(input: SignWebhookInput): SignedWebhook {
  if (!input.body) {
    throw new Error("signWebhook: body is required");
  }
  if (!input.webhookId) {
    throw new Error("signWebhook: webhookId is required");
  }
  const message = buildWebhookCanonicalMessage({
    timestamp: input.timestamp,
    webhookId: input.webhookId,
    body: input.body,
  });
  const signature = signMessage(input.platformPrivateKey, message);
  return {
    body: input.body,
    headers: {
      "X-Sovereign-Signature": signature,
      "X-Sovereign-Signature-Timestamp": input.timestamp,
      "X-Sovereign-Signature-Key-Id": input.platformKeyId,
      "X-Sovereign-Webhook-Id": input.webhookId,
    },
  };
}

// ── Verify (pure; ports to inspector) ───────────────────────────────

const DEFAULT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

export interface VerifyWebhookInput {
  body: string;
  headers: Record<string, string | undefined>;
  expectedPlatformPublicKey: string;
  /** Allow caller to pin to a specific key id (rotation safety). */
  expectedKeyId?: string;
  /** Now, for testability. */
  now?: Date;
  /** How fresh the timestamp must be. Default 5 minutes. */
  freshnessWindowMs?: number;
  /** Optional: dedup callback (returns true if webhookId already
   *  processed). Implements replay defense; injected by caller so
   *  this lib stays pure. */
  isReplay?: (webhookId: string) => boolean;
}

export type WebhookVerifyResult =
  | { valid: true; webhookId: string }
  | {
      valid: false;
      reason:
        | "missing_signature"
        | "missing_timestamp"
        | "missing_webhook_id"
        | "missing_key_id"
        | "key_id_mismatch"
        | "timestamp_invalid"
        | "timestamp_too_old"
        | "timestamp_in_future"
        | "signature_invalid"
        | "replay_detected";
    };

/**
 * Verify a webhook signature. Pure function (modulo the optional
 * `isReplay` callback). Same input → same result.
 *
 * Performs ALL of:
 *   1. Required headers present
 *   2. Optional pinned key-id matches
 *   3. Timestamp is parseable + within freshness window
 *   4. sha256(body) matches the canonical reconstruction
 *   5. Signature verifies against the platform public key
 *   6. Replay check (via injected callback)
 *
 * Same pattern as R44/R45 verifiers. Ports to @sovereign/inspector
 * for offline customer verification of webhook authenticity.
 */
export function verifyWebhook(input: VerifyWebhookInput): WebhookVerifyResult {
  const sig = input.headers["X-Sovereign-Signature"] ??
    input.headers["x-sovereign-signature"];
  const timestamp =
    input.headers["X-Sovereign-Signature-Timestamp"] ??
    input.headers["x-sovereign-signature-timestamp"];
  const keyId =
    input.headers["X-Sovereign-Signature-Key-Id"] ??
    input.headers["x-sovereign-signature-key-id"];
  const webhookId =
    input.headers["X-Sovereign-Webhook-Id"] ??
    input.headers["x-sovereign-webhook-id"];

  if (!sig) return { valid: false, reason: "missing_signature" };
  if (!timestamp) return { valid: false, reason: "missing_timestamp" };
  if (!keyId) return { valid: false, reason: "missing_key_id" };
  if (!webhookId) return { valid: false, reason: "missing_webhook_id" };

  if (input.expectedKeyId && input.expectedKeyId !== keyId) {
    return { valid: false, reason: "key_id_mismatch" };
  }

  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) {
    return { valid: false, reason: "timestamp_invalid" };
  }
  const now = input.now ?? new Date();
  const freshness = input.freshnessWindowMs ?? DEFAULT_FRESHNESS_WINDOW_MS;
  const ageMs = now.getTime() - ts.getTime();
  if (ageMs > freshness) {
    return { valid: false, reason: "timestamp_too_old" };
  }
  // Allow a small future-skew (clock drift), e.g. 60s.
  if (ageMs < -60_000) {
    return { valid: false, reason: "timestamp_in_future" };
  }

  // Reconstruct the canonical message and verify.
  const expectedMessage = buildWebhookCanonicalMessage({
    timestamp,
    webhookId,
    body: input.body,
  });
  if (!verifySignature(input.expectedPlatformPublicKey, expectedMessage, sig)) {
    return { valid: false, reason: "signature_invalid" };
  }

  // Replay defense (caller's responsibility; we just ask).
  if (input.isReplay && input.isReplay(webhookId)) {
    return { valid: false, reason: "replay_detected" };
  }

  return { valid: true, webhookId };
}

/**
 * Pure: extract the headers a customer needs to forward to
 * `verifyWebhook`. Used by reference docs + inspector verifier.
 */
export const REQUIRED_WEBHOOK_HEADER_NAMES = [
  "X-Sovereign-Signature",
  "X-Sovereign-Signature-Timestamp",
  "X-Sovereign-Signature-Key-Id",
  "X-Sovereign-Webhook-Id",
] as const;
