/**
 * SOVEREIGN MATRIX — INTERNAL_WEBHOOK_SECRET access helper.
 *
 * Problem this solves:
 *   Three callsites previously did `process.env.INTERNAL_WEBHOOK_SECRET || ""`.
 *   The receiver (auto-onboard) compares with `length > 0 &&` so it fails
 *   CLOSED even on an empty fallback — exploitable today only via header
 *   injection. The two senders (payfast + paystack webhooks) silently sent
 *   an empty header, the receiver silently rejected it, and the auto-onboard
 *   pipeline silently broke. No alert, no audit trail.
 *
 * What this does:
 *   - Single source of truth for reading the secret.
 *   - Returns `null` when the env var is unset or empty.
 *   - Logs a SINGLE warning on the first miss (deduplicated) so an operator
 *     sees the misconfiguration without spam.
 *   - Callers explicitly handle the null case — no implicit empty fallback.
 *
 * Senders: skip the internal call and log a warning when null.
 * Receiver: accept iff the helper returns a non-null secret AND the presented
 *   header timing-safe-matches. Fall through to Clerk session check otherwise.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("internal-secret");

let _warnedOnce = false;

/**
 * Returns the configured INTERNAL_WEBHOOK_SECRET, or null when unset/empty.
 * Logs a single warning the first time it's missing.
 */
export function getInternalWebhookSecret(): string | null {
  const raw = process.env.INTERNAL_WEBHOOK_SECRET;
  if (typeof raw !== "string" || raw.length === 0) {
    if (!_warnedOnce) {
      _warnedOnce = true;
      log.warn(
        "INTERNAL_WEBHOOK_SECRET is unset — internal server-to-server " +
          "webhook calls (payment webhook → auto-onboard) will be skipped. " +
          "Set the env var in production to restore the auto-onboard pipeline.",
      );
    }
    return null;
  }
  return raw;
}
