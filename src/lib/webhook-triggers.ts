/**
 * Webhook triggers — external events fire agents, results deliver
 * back to caller URLs.
 *
 * Flow:
 *   1. Customer registers a subscription: { agentSlug, callbackUrl,
 *      secret }. We store the secret (HMAC key).
 *   2. External system POSTs to /api/agents/trigger/[slug] with an
 *      HMAC-SHA256 signature over the body using the secret.
 *   3. We verify the HMAC, run the agent (via the existing invoke lib),
 *      then POST the result to callbackUrl — ALSO HMAC-signed so the
 *      subscriber can verify authenticity on receipt.
 *   4. Every attempt is logged to webhook_delivery_attempts.
 *
 * Retry strategy: on any delivery failure (network error or response
 * status >= 500), retry up to 3 times with exponential backoff
 * (1s → 5s → 25s). Response status 4xx is NOT retried — a subscriber
 * rejecting the payload intentionally shouldn't trigger a retry storm.
 *
 * Security:
 *   * Secrets are 32+ bytes of random; the platform generates them.
 *     Subscribers retrieve once at registration and never again.
 *   * HMAC signatures use SHA-256 in hex. Headers:
 *       X-Sovereign-Signature: sha256=<hex>
 *       X-Sovereign-Timestamp: <unix-seconds>
 *     Subscribers verify by checking timestamp is within 5 minutes
 *     AND recomputing HMAC over `${timestamp}.${body}`.
 *   * Timing-safe comparison on verification (no leaking via early exit).
 *
 * Privacy:
 *   * Delivery attempts store only the first 500 chars of the response
 *     body — enough to debug, not enough to silently persist sensitive
 *     customer data in our logs.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  webhookDeliveryAttempts,
  webhookSubscriptions,
} from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhook-triggers");

/* ─── Types ───────────────────────────────────────────────────── */

export interface TriggerVerdict {
  ok: boolean;
  code?:
    | "no_db"
    | "subscription_not_found"
    | "subscription_inactive"
    | "bad_signature"
    | "stale_timestamp"
    | "wrong_agent_slug";
  reason?: string;
  /** Present when ok:true — used by the route to run the agent. */
  subscription?: {
    id: string;
    callbackUrl: string;
    secret: string;
    ownerEmail: string;
  };
}

/* ─── HMAC helpers (WebCrypto, no deps) ───────────────────────── */

const TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(secret);
  const msgBytes = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison. Hex strings only.
 * Prevents timing side-channels on signature verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ─── Verification ────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/**
 * Verify an incoming trigger request:
 *   1. The X-Sovereign-Timestamp header is within 5 minutes of now
 *   2. HMAC-SHA256(secret, `${timestamp}.${body}`) matches the
 *      X-Sovereign-Signature header
 *   3. The subscription's agent_slug matches the URL's slug
 *
 * Returns { ok: true, subscription } on success.
 */
export async function verifyTriggerRequest(args: {
  subscriptionId: string;
  agentSlugFromUrl: string;
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
}): Promise<TriggerVerdict> {
  if (!databaseIsConfigured()) {
    return { ok: false, code: "no_db", reason: "marketplace offline" };
  }

  // Load subscription.
  let sub;
  try {
    const rows = await db
      .select({
        id: webhookSubscriptions.id,
        agentSlug: webhookSubscriptions.agentSlug,
        callbackUrl: webhookSubscriptions.callbackUrl,
        secret: webhookSubscriptions.secret,
        ownerEmail: webhookSubscriptions.ownerEmail,
        isActive: webhookSubscriptions.isActive,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, args.subscriptionId))
      .limit(1);
    sub = rows[0];
  } catch (err) {
    log.error("verifyTriggerRequest: subscription lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, code: "no_db" };
  }

  if (!sub) return { ok: false, code: "subscription_not_found" };
  if (!sub.isActive) return { ok: false, code: "subscription_inactive" };
  if (sub.agentSlug !== args.agentSlugFromUrl) {
    return { ok: false, code: "wrong_agent_slug" };
  }

  // Verify timestamp freshness.
  if (!args.timestampHeader) {
    return { ok: false, code: "bad_signature", reason: "missing timestamp" };
  }
  const tsSeconds = parseInt(args.timestampHeader, 10);
  if (!Number.isFinite(tsSeconds)) {
    return { ok: false, code: "bad_signature", reason: "invalid timestamp" };
  }
  const ageMs = Math.abs(Date.now() - tsSeconds * 1000);
  if (ageMs > TIMESTAMP_SKEW_MS) {
    return { ok: false, code: "stale_timestamp", reason: `${Math.round(ageMs / 1000)}s skew` };
  }

  // Verify HMAC.
  if (!args.signatureHeader) {
    return { ok: false, code: "bad_signature", reason: "missing signature" };
  }
  const expectedPrefix = "sha256=";
  if (!args.signatureHeader.startsWith(expectedPrefix)) {
    return { ok: false, code: "bad_signature", reason: "expected sha256= prefix" };
  }
  const providedHex = args.signatureHeader.slice(expectedPrefix.length);
  const signedPayload = `${args.timestampHeader}.${args.rawBody}`;
  const computedHex = await hmacSha256Hex(sub.secret, signedPayload);
  if (!timingSafeEqual(providedHex, computedHex)) {
    return { ok: false, code: "bad_signature", reason: "HMAC mismatch" };
  }

  return {
    ok: true,
    subscription: {
      id: sub.id,
      callbackUrl: sub.callbackUrl,
      secret: sub.secret,
      ownerEmail: sub.ownerEmail,
    },
  };
}

/* ─── Delivery (outgoing webhook POST to callbackUrl) ─────────── */

export interface DeliveryResult {
  delivered: boolean;
  status?: number;
  error?: string;
  attempts: number;
}

/**
 * POST an agent result back to a subscriber's callbackUrl.
 * Retries up to 3 times with exponential backoff (1s, 5s, 25s).
 * Each attempt writes a row to webhook_delivery_attempts for audit.
 *
 * 4xx responses are NOT retried (subscriber rejected on purpose).
 * 5xx + network errors ARE retried.
 */
export async function deliverWebhookResult(args: {
  subscriptionId: string;
  secret: string;
  callbackUrl: string;
  invocationId: string;
  body: unknown;
}): Promise<DeliveryResult> {
  const payload = JSON.stringify(args.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${await hmacSha256Hex(
    args.secret,
    `${timestamp}.${payload}`,
  )}`;

  const delays = [0, 1_000, 5_000, 25_000]; // attempt 1, 2, 3, 4
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (delays[attempt - 1] > 0) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt - 1]));
    }

    let responseStatus: number | undefined;
    let bodyPreview: string | undefined;
    let errorMessage: string | undefined;
    let delivered = false;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(args.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sovereign-Signature": signature,
          "X-Sovereign-Timestamp": timestamp,
          "X-Sovereign-Invocation-Id": args.invocationId,
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timer);
      responseStatus = res.status;
      bodyPreview = (await res.text().catch(() => "")).slice(0, 500);
      delivered = res.ok;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Best-effort log (don't let an audit-log failure mask the real outcome).
    await db
      .insert(webhookDeliveryAttempts)
      .values({
        subscriptionId: args.subscriptionId,
        invocationId: args.invocationId,
        attemptNumber: attempt,
        responseStatus: responseStatus ?? null,
        responseBodyPreview: bodyPreview ?? null,
        delivered,
        errorMessage: errorMessage ?? null,
      })
      .catch((err) => {
        log.warn("failed to record delivery attempt", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    lastStatus = responseStatus;
    lastError = errorMessage;

    if (delivered) {
      // Success — bump trigger_count, done.
      await db
        .update(webhookSubscriptions)
        .set({
          triggerCount: sql`${webhookSubscriptions.triggerCount} + 1`,
          lastTriggeredAt: sql`NOW()`,
        })
        .where(eq(webhookSubscriptions.id, args.subscriptionId))
        .catch(() => {
          /* cosmetic */
        });
      return { delivered: true, status: responseStatus, attempts: attempt };
    }

    // 4xx — don't retry (subscriber rejected).
    if (responseStatus && responseStatus >= 400 && responseStatus < 500) {
      break;
    }
  }

  // All attempts failed — bump failure_count.
  await db
    .update(webhookSubscriptions)
    .set({
      failureCount: sql`${webhookSubscriptions.failureCount} + 1`,
    })
    .where(eq(webhookSubscriptions.id, args.subscriptionId))
    .catch(() => {
      /* cosmetic */
    });

  return {
    delivered: false,
    status: lastStatus,
    error: lastError,
    attempts: 4,
  };
}

/* ─── Helpers (creation, secret generation) ───────────────────── */

/** Generate a cryptographically-random 32-byte secret as hex. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Find the active subscription(s) for an agent slug (for debug / admin). */
export async function listActiveSubscriptionsForAgent(
  agentSlug: string,
): Promise<Array<{ id: string; label: string; callbackUrl: string; triggerCount: number }>> {
  if (!databaseIsConfigured() || !agentSlug) return [];
  try {
    const rows = await db
      .select({
        id: webhookSubscriptions.id,
        label: webhookSubscriptions.label,
        callbackUrl: webhookSubscriptions.callbackUrl,
        triggerCount: webhookSubscriptions.triggerCount,
      })
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.agentSlug, agentSlug),
          eq(webhookSubscriptions.isActive, true),
        ),
      );
    return rows;
  } catch {
    return [];
  }
}
