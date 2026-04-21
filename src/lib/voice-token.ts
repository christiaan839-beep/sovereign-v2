/**
 * voice-token.ts — minimal signed session tokens for the voice WebSocket.
 *
 * We don't pull in `jsonwebtoken` or `jose` for this — a 60-second TTL
 * opaque-string token with HMAC-SHA256 is simpler and smaller. Format:
 *
 *   base64url(JSON(payload)).base64url(HMAC-SHA256(encodedPayload))
 *
 * The WS route (Plan 3.5) verifies the token on the first "auth" message.
 * If verification fails, the socket closes with code 1008 (policy
 * violation). Tokens are single-use in spirit (60s window) but not
 * enforced at the DB level — the hold ID inside the payload is the
 * real billing primary key.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VoiceTokenPayload {
  userId: string;
  personaId: string;
  holdId: string;
  /** Unix epoch seconds — typically now + 60. */
  exp: number;
}

/** base64url: base64 with "+" → "-", "/" → "_", no padding. */
function base64url(buf: Buffer): string {
  return buf.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}

/**
 * Sign a short-lived voice-session token. The payload is JSON-serialized,
 * base64url-encoded, then HMAC'd with SHA-256. Concatenated with "."
 * so the two halves are easy to split on verify.
 */
export function signVoiceToken(payload: VoiceTokenPayload, secret: string): string {
  if (!secret || secret.length < 16) {
    throw new Error("VOICE_SESSION_SECRET must be at least 16 characters");
  }
  const json = JSON.stringify(payload);
  const encoded = base64url(Buffer.from(json, "utf8"));
  const sig = createHmac("sha256", secret).update(encoded).digest();
  return `${encoded}.${base64url(sig)}`;
}

/**
 * Verify + decode a voice-session token. Returns the payload on success,
 * null on any failure (bad signature, expired, malformed). Never throws
 * — the WS route just closes on null.
 */
export function verifyVoiceToken(token: string, secret: string): VoiceTokenPayload | null {
  if (!secret) return null;
  if (typeof token !== "string") return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx < 0 || dotIdx === token.length - 1) return null;

  const encodedPayload = token.slice(0, dotIdx);
  const encodedSig = token.slice(dotIdx + 1);

  // Recompute signature and constant-time compare.
  const expectedSig = createHmac("sha256", secret).update(encodedPayload).digest();
  let actualSig: Buffer;
  try {
    actualSig = fromBase64url(encodedSig);
  } catch {
    return null;
  }

  if (expectedSig.length !== actualSig.length) {
    // Pad-and-compare to keep timing constant even on length mismatch.
    timingSafeEqual(expectedSig, expectedSig);
    return null;
  }
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  // Signature valid — parse payload.
  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64url(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }
  if (!isVoiceTokenPayload(payload)) return null;

  // Expiry check last — after shape is confirmed so we compare a number.
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

function isVoiceTokenPayload(v: unknown): v is VoiceTokenPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.userId === "string" &&
    typeof o.personaId === "string" &&
    typeof o.holdId === "string" &&
    typeof o.exp === "number"
  );
}
