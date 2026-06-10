/**
 * INTERNAL_WEBHOOK_SECRET — single accessor + verifier.
 *
 * Three routes used to carry their own
 * `process.env.INTERNAL_WEBHOOK_SECRET || ""` fallback (BACKLOG H3).
 * Not exploitable — the receiver's length>0 check failed closed — but
 * an empty-string secret circulating through call sites is one
 * refactor away from an empty-vs-empty compare passing. This module
 * is the only sanctioned access path: the secret is either a
 * non-empty string or null, never "".
 */
import crypto from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("internal-secret");

let warnedMissing = false;

/** Trimmed secret, or null when unset. Never returns "". */
export function getInternalWebhookSecret(): string | null {
  const raw = process.env.INTERNAL_WEBHOOK_SECRET?.trim();
  if (!raw) {
    if (!warnedMissing) {
      warnedMissing = true;
      log.warn(
        "INTERNAL_WEBHOOK_SECRET is not set — internal server-to-server calls (auto-onboard) are disabled",
      );
    }
    return null;
  }
  return raw;
}

/** Constant-time compare to avoid timing-leak on the internal secret. */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Fail-closed verifier for `x-sovereign-internal-secret` headers.
 * False when the env is unset, the header is absent or empty, or the
 * values mismatch. There is no configuration in which this returns
 * true for an empty presented value.
 */
export function verifyInternalSecret(
  presented: string | null | undefined,
): boolean {
  const secret = getInternalWebhookSecret();
  if (!secret || !presented) return false;
  return timingSafeStringEqual(presented, secret);
}

/** Test-only: reset the warn-once latch between cases. */
export function __resetInternalSecretWarning(): void {
  warnedMissing = false;
}
