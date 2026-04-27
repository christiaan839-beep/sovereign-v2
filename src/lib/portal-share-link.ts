/**
 * PORTAL SHARE-LINK SIGNING — HMAC-SHA256 over a clientId.
 *
 * Why this exists:
 *   /api/portal/metrics is a "client portal" surface — agencies want to
 *   share a URL with a client so the client can view their metrics
 *   without setting up a Clerk account. The earlier design used the
 *   clientId itself as the access token, which was broken: clientId is
 *   the user's email, which is not a secret.
 *
 *   This module produces SIGNED share links the agency can hand out:
 *
 *     /portal/<clientId>?token=<HMAC-SHA256(clientId, secret)>
 *
 *   The token can't be forged without `PORTAL_SHARE_SECRET`, so an
 *   attacker who knows the email can no longer impersonate the
 *   relationship. To revoke a leaked link, rotate the secret — every
 *   outstanding link goes dead at once.
 *
 * Security notes:
 *   - Signing is per-clientId, NOT per-link. Two clients with the
 *     same email get the same token (which is fine — one of them owns
 *     the email anyway).
 *   - Tokens have NO expiry by default. Add an expiry by including a
 *     timestamp + checking it inside `verifyShareToken` once the
 *     UX warrants it.
 *   - We compare in constant time via `timingSafeEqual` to avoid
 *     timing side-channels.
 *   - If `PORTAL_SHARE_SECRET` is missing, `signShareToken()` THROWS
 *     and `verifyShareToken()` returns false — fail closed, never
 *     fail open with a default secret.
 *
 * Required env:
 *   PORTAL_SHARE_SECRET — at least 32 bytes of random base64. If you
 *   rotate it, regenerate every share link.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Read the signing secret. Throws if missing — callers must handle
 * the error explicitly. We don't fall back to a default because a
 * shared default would let any code reader forge tokens.
 */
function getSecret(): string {
  const secret = process.env.PORTAL_SHARE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "PORTAL_SHARE_SECRET is missing or too short (need >=16 chars). " +
        "Set it in env to enable portal share links.",
    );
  }
  return secret;
}

/**
 * Produce a hex-encoded HMAC-SHA256 token for the given clientId.
 * The token is safe to embed in a URL (just hex digits).
 *
 * @throws when PORTAL_SHARE_SECRET is missing or too short
 */
export function signShareToken(clientId: string): string {
  const secret = getSecret();
  return createHmac("sha256", secret).update(clientId).digest("hex");
}

/**
 * Verify an incoming `?token=` query parameter against the clientId
 * being requested. Constant-time comparison, returns false on any
 * failure mode (missing secret, malformed token, mismatch).
 *
 * NEVER throws — designed to be the gate at the start of a route
 * handler. A throw here would 500 every legitimate request whenever
 * the secret rotated mid-deploy.
 */
export function verifyShareToken(clientId: string, token: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(clientId).digest("hex");
  // Same length so timingSafeEqual doesn't throw — both should be
  // 64 hex chars for SHA-256.
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Build the full share URL. Convenience wrapper around signShareToken
 * so callers don't have to remember the parameter name.
 *
 * @throws when PORTAL_SHARE_SECRET is missing
 */
export function buildShareUrl(baseUrl: string, clientId: string): string {
  const token = signShareToken(clientId);
  const url = new URL(`/portal/${encodeURIComponent(clientId)}`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
