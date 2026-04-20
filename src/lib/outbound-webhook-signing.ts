import { createHmac, timingSafeEqual } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhook-signing");

/**
 * OUTBOUND WEBHOOK SIGNING — Stripe-compatible HMAC-SHA256.
 *
 * When Sovereign Matrix fires a webhook to a user's endpoint (e.g.
 * "lead qualified", "playbook completed"), we include an
 * `X-Sovereign-Signature` header so the receiver can verify the
 * payload hasn't been tampered with and was actually sent by us.
 *
 * Header format (same as Stripe):
 *   X-Sovereign-Signature: t=<timestamp>,v1=<hmac_sha256>
 *
 * Where:
 *   t = unix timestamp (seconds) of when we sent the webhook
 *   v1 = HMAC-SHA256(secret, `${t}.${body}`)
 *
 * Rotating the signing secret invalidates old signatures immediately;
 * we publish the new secret + suggested rollover window in the
 * dashboard (48 hours to update receivers).
 *
 * Clients verify by:
 *   1. Parse the header into {t, v1}
 *   2. Recompute HMAC-SHA256(secret, `${t}.${raw_body}`)
 *   3. Compare with timing-safe equality
 *   4. Check t is within 5 minutes of now (prevents replay)
 */

export interface SignedWebhookHeaders {
  "X-Sovereign-Signature": string;
  "X-Sovereign-Event": string;
  "X-Sovereign-Delivery-Id": string;
  "X-Sovereign-Timestamp": string;
  "Content-Type": "application/json";
  "User-Agent": string;
}

/**
 * Build the headers for a signed webhook POST. The caller is
 * responsible for the actual HTTP request (so this stays
 * transport-agnostic and easy to test).
 *
 * Returns the headers plus the exact body string to POST — using
 * `body` rather than serializing at request time guarantees the
 * signed bytes match the sent bytes.
 */
export function buildSignedWebhook(params: {
  secret: string;
  event: string;
  payload: unknown;
  deliveryId?: string;
}): { headers: SignedWebhookHeaders; body: string } {
  const { secret, event, payload } = params;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const deliveryId = params.deliveryId ?? crypto.randomUUID();
  const body = JSON.stringify(payload);

  const signaturePayload = `${timestamp}.${body}`;
  const v1 = createHmac("sha256", secret).update(signaturePayload).digest("hex");

  return {
    headers: {
      "X-Sovereign-Signature": `t=${timestamp},v1=${v1}`,
      "X-Sovereign-Event": event,
      "X-Sovereign-Delivery-Id": deliveryId,
      "X-Sovereign-Timestamp": timestamp,
      "Content-Type": "application/json",
      "User-Agent": "SovereignMatrix/1.0 (+https://sovereignmatrix.agency)",
    },
    body,
  };
}

/**
 * Server-side verification — used when Sovereign receives a webhook
 * from ANOTHER Sovereign tenant (e.g. federated agent networks).
 *
 * Returns `true` iff the signature is valid AND the timestamp is
 * within the tolerance window.
 */
export function verifyInboundSignature(params: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string } {
  const { secret, rawBody, signatureHeader } = params;
  const tolerance = params.toleranceSeconds ?? 300; // 5 minutes

  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature_header" };
  }

  // Parse `t=…,v1=…` into key/value pairs.
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) {
    return { valid: false, reason: "malformed_signature" };
  }

  // Tolerance check — reject signatures too old or from the future.
  const timestamp = parseInt(t, 10);
  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: "invalid_timestamp" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const skew = Math.abs(nowSec - timestamp);
  if (skew > tolerance) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  // Recompute HMAC and compare in constant time.
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(v1, "hex");
  } catch {
    return { valid: false, reason: "malformed_hex" };
  }

  if (expected.length !== actual.length) {
    return { valid: false, reason: "length_mismatch" };
  }

  const match = timingSafeEqual(expected, actual);
  if (!match) {
    log.warn("Webhook signature verification failed", { reason: "hmac_mismatch", timestamp });
    return { valid: false, reason: "hmac_mismatch" };
  }

  return { valid: true };
}

/**
 * Convenience: send a signed webhook with sensible defaults (10s
 * timeout, no retries). Callers that need retries should use the
 * job queue (Proposal A — scheduler).
 */
export async function deliverSignedWebhook(params: {
  url: string;
  secret: string;
  event: string;
  payload: unknown;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { url, timeoutMs = 10_000 } = params;
  const signed = buildSignedWebhook(params);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: signed.headers as unknown as HeadersInit,
      body: signed.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
