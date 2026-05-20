/**
 * SOVEREIGN MATRIX — Internal webhook secret helper (wave 111.x).
 *
 * Centralises the `INTERNAL_WEBHOOK_SECRET` plumbing for the 3 routes
 * that previously each wrote `process.env.INTERNAL_WEBHOOK_SECRET || ""`
 * and timing-safe-compared against the presented header.
 *
 * The bare `|| ""` pattern was flagged by the wave-107.2 review as a
 * footgun (BACKLOG H3): not exploitable today because the call sites
 * also gate on `length > 0`, but one cleanup PR that drops the
 * length guard would turn the empty fallback into an authentication
 * bypass (presented "" === stored "" → timing-safe equal).
 *
 * This helper closes the footgun three ways:
 *   1. `verifyInternalSecret(presented)` itself enforces the
 *      non-empty + minimum-length check internally — even if a future
 *      caller forgets the guard, the helper still rejects.
 *   2. `hasInternalSecretConfigured()` lets webhook callers decide
 *      whether to attempt the internal call at all (avoids spamming
 *      an empty header that auto-onboard would reject).
 *   3. A one-shot startup log in production when the env is missing,
 *      so misconfiguration surfaces in observability instead of
 *      silently breaking onboarding.
 */

import crypto from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal-secret");

/**
 * Minimum required secret length. 16 bytes (≈ 128 bits of entropy)
 * is the floor — anything shorter is rejected even if exactly
 * matched, on the theory that an attacker who finds a short secret
 * could brute-force it anyway.
 */
const MIN_SECRET_LENGTH = 16;

let _warnedMissing = false;

function readSecret(): string | null {
  const raw = process.env.INTERNAL_WEBHOOK_SECRET;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) {
    if (
      !_warnedMissing &&
      process.env.NODE_ENV === "production" &&
      process.env.VITEST !== "true"
    ) {
      _warnedMissing = true;
      log.error(
        "INTERNAL_WEBHOOK_SECRET is missing or too short — webhook→internal calls will be rejected",
        { minLength: MIN_SECRET_LENGTH },
      );
    }
    return null;
  }
  return trimmed;
}

/**
 * Returns true when a sufficiently-strong INTERNAL_WEBHOOK_SECRET is
 * configured. Callers (PayFast / Paystack / Stripe webhooks) should
 * check this BEFORE issuing the internal auto-onboard call — if
 * false, they skip the call and log explicitly instead of sending
 * an empty header that the receiver would reject silently.
 */
export function hasInternalSecretConfigured(): boolean {
  return readSecret() !== null;
}

/**
 * Returns the secret for outbound internal calls, or null when not
 * configured. Callers MUST tolerate null (skip the call + log).
 */
export function getInternalSecretForOutboundCall(): string | null {
  return readSecret();
}

/**
 * Verifies that the presented header matches the configured secret
 * using a constant-time compare.
 *
 * Fails closed when:
 *   - INTERNAL_WEBHOOK_SECRET env is unset, empty, or shorter than
 *     MIN_SECRET_LENGTH (defends against the empty-fallback footgun)
 *   - presented is not a string
 *   - presented length ≠ secret length (constant-time compare needs
 *     equal-length inputs; a length mismatch returns false without
 *     calling timingSafeEqual, which would throw)
 *
 * This function is the ONLY sanctioned way to check the internal
 * secret. Routes that compare it directly are gradually being
 * migrated; the eslint rule lives at `.eslintrc` (not yet — flagged
 * for wave 111.x.1).
 */
export function verifyInternalSecret(presented: unknown): boolean {
  if (typeof presented !== "string") return false;
  const secret = readSecret();
  if (secret === null) return false;
  if (presented.length !== secret.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(presented, "utf8"),
      Buffer.from(secret, "utf8"),
    );
  } catch {
    return false;
  }
}
