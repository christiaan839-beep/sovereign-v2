/**
 * SOVEREIGN MATRIX — Signed client-portal access tokens (wave 122, H4).
 *
 * Closes the /api/portal/metrics exposure where the clientId (a customer
 * email) in the URL WAS the credential: unauthenticated, unthrottled,
 * guessable. A portal link now carries a signed bearer token whose `sub`
 * must match the clientId being queried, so knowing someone's email is no
 * longer enough — you need a link minted by the platform.
 *
 * Deliberately a sibling of agent-tokens.ts rather than a reuse: that
 * module's own contract caps TTL at one hour ("anything beyond an hour
 * should use a different primitive") while portal links live for weeks,
 * and its claims/table are agent-run-shaped. Same wire format, same
 * signing idioms, different lifetime and audience:
 *
 *   header  = { alg: "HS256", typ: "sov-portal" }
 *   payload = { sub, sco, iat, exp, iss }
 *   token   = b64url(header) + "." + b64url(payload) + "." + hmac
 *
 * Revocation model (v1): stateless. Tokens die by expiry; rotating
 * PORTAL_TOKEN_SIGNING_SECRET (or the fallback secret) kills every
 * outstanding link at once. Per-link revocation would need a table —
 * deferred until portals carry write scopes.
 */

import { createHmac } from "crypto";

const ISSUER = "sovereignmatrix.agency";
const DEFAULT_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const MIN_TTL_SECONDS = 3600; // 1 hour
const MAX_TTL_SECONDS = 90 * 24 * 3600; // 90 days

export type PortalTokenScope = "portal:read";

export interface PortalTokenClaims {
  /** The clientId this link grants access to (customer email / userId / slug). */
  sub: string;
  sco: PortalTokenScope[];
  iat: number;
  exp: number;
  iss: string;
}

export interface MintedPortalToken {
  token: string;
  claims: PortalTokenClaims;
  expiresAt: string;
}

export type PortalVerifyReason =
  | "malformed"
  | "bad-header"
  | "bad-signature"
  | "expired"
  | "wrong-issuer"
  | "wrong-subject"
  | "no-key";

export interface PortalVerifyResult {
  ok: boolean;
  claims?: PortalTokenClaims;
  reason?: PortalVerifyReason;
}

function getSigningKey(): string | null {
  const s =
    process.env.PORTAL_TOKEN_SIGNING_SECRET ??
    process.env.AGENT_RUN_SIGNING_SECRET ??
    process.env.CRON_SECRET ??
    null;
  if (!s || s.length < 16) return null;
  return s;
}

/**
 * Mint a signed portal link token for a clientId. Throws when no signing
 * secret is configured — issuance must never silently produce an
 * unverifiable link.
 */
export function mintPortalToken(input: {
  clientId: string;
  ttlSeconds?: number;
}): MintedPortalToken {
  const clientId = input.clientId.trim();
  if (!clientId) throw new Error("mintPortalToken: clientId is required");
  const key = getSigningKey();
  if (!key) {
    throw new Error(
      "mintPortalToken: no signing secret configured (PORTAL_TOKEN_SIGNING_SECRET / AGENT_RUN_SIGNING_SECRET / CRON_SECRET)",
    );
  }

  const ttl = Math.max(
    MIN_TTL_SECONDS,
    Math.min(MAX_TTL_SECONDS, input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  );
  const now = Math.floor(Date.now() / 1000);
  const claims: PortalTokenClaims = {
    sub: clientId,
    sco: ["portal:read"],
    iat: now,
    exp: now + ttl,
    iss: ISSUER,
  };

  const header = b64urlEncode(
    JSON.stringify({ alg: "HS256", typ: "sov-portal" }),
  );
  const payload = b64urlEncode(JSON.stringify(claims));
  const signed = `${header}.${payload}`;
  const sig = b64urlEncodeBuffer(
    createHmac("sha256", key).update(signed).digest(),
  );

  return {
    token: `${signed}.${sig}`,
    claims,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

/**
 * Verify a portal token offline (signature + expiry + issuer) and check
 * that its subject matches the clientId being requested. Fails CLOSED
 * when no signing secret is configured — an unconfigured deployment must
 * not become an open portal.
 */
export function verifyPortalToken(
  token: string,
  expectedClientId: string,
): PortalVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: PortalTokenClaims;
  try {
    header = JSON.parse(b64urlDecode(headerB64));
    claims = JSON.parse(b64urlDecode(payloadB64)) as PortalTokenClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (header.typ !== "sov-portal" || header.alg !== "HS256")
    return { ok: false, reason: "bad-header" };
  if (claims.iss !== ISSUER) return { ok: false, reason: "wrong-issuer" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now)
    return { ok: false, reason: "expired" };

  const key = getSigningKey();
  if (!key) return { ok: false, reason: "no-key" };

  const expected = b64urlEncodeBuffer(
    createHmac("sha256", key).update(`${headerB64}.${payloadB64}`).digest(),
  );
  if (!constantTimeEqual(expected, sigB64))
    return { ok: false, reason: "bad-signature" };

  if (
    typeof claims.sub !== "string" ||
    claims.sub.trim() !== expectedClientId.trim()
  )
    return { ok: false, reason: "wrong-subject" };

  return { ok: true, claims };
}

// ── Internals (same idioms as agent-tokens.ts) ────────────────────────

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlEncodeBuffer(b: Buffer): string {
  return b
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): string {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
