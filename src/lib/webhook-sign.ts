/**
 * OUTBOUND WEBHOOK SIGNING
 *
 * When the platform sends a webhook to a customer-owned URL (agent
 * run completion, receipt published, deletion event), the payload is
 * signed with a customer-specific HMAC-SHA256 key. The customer's
 * receiving endpoint verifies the signature before trusting the
 * payload — symmetric to how WE verify Stripe / Clerk / HubSpot
 * webhooks coming the other direction.
 *
 * Wire format mirrors Stripe's convention so it's instantly
 * recognizable to webhook authors:
 *
 *   Header: X-Sovereign-Signature: t=<unix-seconds>,v1=<hex-hmac>
 *   Header: X-Sovereign-Event: agent.run.completed
 *   Body:   { agent: "...", receipt: { id, signature, ... }, ... }
 *
 * The HMAC is computed over: `${timestamp}.${rawBody}` — the same
 * dot-concatenation Stripe uses. Customers can reuse any
 * Stripe-pattern webhook verification code with a 1-character
 * substitution.
 *
 * Replay protection: receivers SHOULD reject any signature with a
 * timestamp more than 5 minutes old. The signing function returns
 * the timestamp + signature so receivers have all the data they
 * need to enforce this.
 *
 * Key storage: each subscription owns a 32-byte secret stored
 * encrypted at rest (see src/lib/crypto.ts for the encryption path).
 * The plain-text secret is shown to the customer ONCE on creation —
 * Stripe-style.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Wire-format constants. The version prefix lets us roll forward to
 * a different algorithm (e.g. Ed25519) without breaking customers'
 * existing verification code — they just dispatch on `v2=`.
 */
export const WEBHOOK_SIGNATURE_HEADER = "X-Sovereign-Signature";
export const WEBHOOK_EVENT_HEADER = "X-Sovereign-Event";
export const WEBHOOK_SIGNATURE_VERSION = "v1";

/** Replay window in seconds. Receivers SHOULD enforce. */
export const WEBHOOK_REPLAY_WINDOW_SECONDS = 300;

export interface WebhookSignature {
  /** Unix seconds. */
  timestamp: number;
  /** "v1=<lowercase-hex-hmac>" */
  signature: string;
  /** Combined header value: "t=<ts>,v1=<hex>" — what to send on the wire. */
  header: string;
}

/**
 * Generate a fresh customer-side signing secret. 32 random bytes,
 * base64url-encoded. Show ONCE to the customer at webhook-create
 * time, store the hash (or encrypted form) afterwards.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Sign a raw outbound payload with a customer's HMAC secret.
 * Returns the timestamp + signature so the caller can embed both
 * in the request headers in the exact wire format we publish.
 */
export function signWebhookPayload(
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): WebhookSignature {
  const timestamp = nowSeconds;
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const signature = `${WEBHOOK_SIGNATURE_VERSION}=${mac}`;
  return {
    timestamp,
    signature,
    header: `t=${timestamp},${signature}`,
  };
}

/**
 * Verify a signature against a raw body + secret. Used by:
 *   - test suite (round-trip the wire format)
 *   - customers verifying our outbound webhooks (if they choose to
 *     copy this code instead of reimplementing — it's pure crypto,
 *     no platform deps)
 *
 * Constant-time. Returns false on:
 *   - malformed header (missing t= or v1=)
 *   - timestamp older than `tolerance` seconds (replay defense)
 *   - HMAC mismatch
 *
 * Throws nothing — every error path is a boolean false.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headerValue: string | null | undefined,
  secret: string,
  options: { tolerance?: number; nowSeconds?: number } = {},
): boolean {
  if (!headerValue) return false;
  const tolerance = options.tolerance ?? WEBHOOK_REPLAY_WINDOW_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  const parts = headerValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let timestamp: number | null = null;
  let providedHex: string | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") {
      const n = Number(v);
      if (Number.isFinite(n)) timestamp = n;
    } else if (k === WEBHOOK_SIGNATURE_VERSION) {
      if (/^[0-9a-f]{64}$/i.test(v)) providedHex = v.toLowerCase();
    }
  }

  if (timestamp === null || providedHex === null) return false;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expectedHex = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expectedHex, "utf8"),
      Buffer.from(providedHex, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Dispatch a single outbound webhook. Logs the result but doesn't
 * throw — webhook delivery is best-effort and the caller usually
 * doesn't care whether it succeeded synchronously.
 *
 * Customers SHOULD return 2xx within 30s. On non-2xx or timeout,
 * the platform's retry policy (out of scope here — wire to the job
 * queue) decides whether to retry.
 */
export interface DispatchOptions {
  url: string;
  event: string;
  payload: unknown;
  secret: string;
  /** Override fetch (testing). */
  fetch?: typeof globalThis.fetch;
  /** Timeout in ms. Default 30s. */
  timeoutMs?: number;
}

export interface DispatchResult {
  ok: boolean;
  status: number | null;
  durationMs: number;
  signature: string;
  error?: string;
}

export async function dispatchWebhook(
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const rawBody = JSON.stringify(opts.payload);
  const sig = signWebhookPayload(rawBody, opts.secret);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  const start = Date.now();
  const fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);

  try {
    const res = await fetchFn(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [WEBHOOK_EVENT_HEADER]: opts.event,
        [WEBHOOK_SIGNATURE_HEADER]: sig.header,
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - start,
      signature: sig.signature,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - start,
      signature: sig.signature,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
