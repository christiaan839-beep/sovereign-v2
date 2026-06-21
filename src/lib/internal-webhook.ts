/**
 * SOVEREIGN MATRIX — Internal webhook secret (shared contract)
 *
 * Server-to-server calls between trusted internal routes (payment
 * webhooks → auto-onboard, etc.) authenticate with a shared
 * `x-sovereign-internal-secret` header matching `INTERNAL_WEBHOOK_SECRET`.
 *
 * Before this module, three call sites each read
 * `process.env.INTERNAL_WEBHOOK_SECRET || ""`. The `|| ""` fallback was a
 * footgun (BACKLOG H3): an unset env var degraded silently to the empty
 * string. Today the receiver fails closed (it guards `length > 0`), but a
 * future refactor that dropped that guard would let an empty header equal an
 * empty secret and authorize any caller. Centralising the contract here makes
 * the fail-closed behaviour the single source of truth and impossible to
 * accidentally weaken site-by-site.
 *
 * Contract:
 *   - `getInternalWebhookSecret()` → the secret, or `null` when unset/blank.
 *      Callers MUST skip the request when null rather than send an empty
 *      header (which the receiver will reject anyway, wasting a round trip).
 *   - `verifyInternalWebhookSecret(presented)` → fail-closed, constant-time
 *      verification. Returns false when the secret is unconfigured, so a
 *      missing env var can never authorize a caller.
 */

import crypto from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal-webhook");

/**
 * Returns the configured internal webhook secret, or `null` when it is
 * unset/blank. A blank secret is treated as "not configured" — callers
 * should skip the server-to-server request entirely instead of presenting
 * an empty header.
 */
export function getInternalWebhookSecret(): string | null {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (typeof secret !== "string" || secret.length === 0) return null;
  return secret;
}

/** Constant-time compare to avoid a timing leak on the secret. */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Guard on byte length, not UTF-16 length: a multibyte char could make
  // equal-length strings produce unequal-length buffers, and timingSafeEqual
  // throws on a length mismatch. Returning false here keeps the verifier
  // fail-closed (clean 403) instead of letting the throw escape to a 500.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Fail-closed verification of a presented internal-secret header.
 *
 * Returns false when the secret is unconfigured (so a missing env var can
 * never authorize a caller) or when the presented value does not match.
 * The comparison is constant-time once both sides are non-empty and equal
 * length.
 */
export function verifyInternalWebhookSecret(
  presented: string | null | undefined,
): boolean {
  const configured = getInternalWebhookSecret();
  if (configured === null) {
    log.warn(
      "INTERNAL_WEBHOOK_SECRET is not configured — rejecting internal call (fail-closed)",
    );
    return false;
  }
  if (typeof presented !== "string" || presented.length === 0) return false;
  return timingSafeStringEqual(presented, configured);
}
