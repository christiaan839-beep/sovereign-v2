/**
 * SOVEREIGN MATRIX — Internal server-to-server secret
 *
 * Single source of truth for INTERNAL_WEBHOOK_SECRET handling.
 * Payment webhooks (PayFast, Paystack, Yoco, Stripe) authenticate to
 * internal agent routes (e.g. /api/_agents/auto-onboard) by presenting
 * `x-sovereign-internal-secret`.
 *
 * Closes BACKLOG H3: call sites previously read
 * `process.env.INTERNAL_WEBHOOK_SECRET || ""` — the empty-string
 * fallback happened to fail closed on the receiver (length-0 compare)
 * but let senders fire requests with an empty header, and a future
 * receiver that forgot the length check would have been an open door.
 * Here the unset case is explicit: senders get `null` and must skip
 * the call; receivers always fail closed.
 */
import { timingSafeEqual } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal-secret");

export const INTERNAL_SECRET_HEADER = "x-sovereign-internal-secret";

/** Constant-time compare to avoid timing-leak on the internal secret. */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * The configured secret, or null when unset/blank. Senders MUST skip
 * the internal call when this returns null — never send an empty header.
 */
export function getInternalWebhookSecret(): string | null {
  const secret = (process.env.INTERNAL_WEBHOOK_SECRET || "").trim();
  if (!secret) return null;
  return secret;
}

/**
 * Receiver-side gate: constant-time check of the internal-secret
 * header. Fails closed (returns false) when the env var is unset —
 * an unset secret must never grant access.
 */
export function verifyInternalSecretHeader(req: Request): boolean {
  const secret = getInternalWebhookSecret();
  if (!secret) {
    log.warn(
      "INTERNAL_WEBHOOK_SECRET is not set — internal server-to-server auth is disabled (failing closed)",
    );
    return false;
  }
  const presented = req.headers.get(INTERNAL_SECRET_HEADER) || "";
  return timingSafeStringEqual(presented, secret);
}
