/**
 * SOVEREIGN MATRIX — Attack-fingerprint extraction (wave 99).
 *
 * Pure module. Given a `Request` and a structured detection result,
 * produces a NON-PII fingerprint suitable for broadcast across the
 * federation. The fingerprint must be:
 *
 *   - Reproducible: two members of the federation that see the same
 *     attack produce the same fingerprint (otherwise correlation
 *     across nodes is impossible).
 *   - Non-reversible: an attacker who obtains the published feed
 *     cannot recover the original payload or victim's IP.
 *   - Bounded: every field has a max size + enum; the bulletin
 *     row never grows unbounded.
 *
 * Explicit non-goals (the ethics line):
 *   - We do NOT include raw client IPs. Even a sha256 of an IP is
 *     re-identifiable for individuals (a /32 has only 2^32 preimages,
 *     trivial to brute-force). The fingerprint uses TLS JA4 +
 *     User-Agent hash + payload-class instead.
 *   - We do NOT include raw payloads or extracted tokens. Only the
 *     payload's classification + a sha256 commitment.
 *   - We do NOT include any user-identifiable header (cookies,
 *     auth tokens, x-real-ip values).
 */

import { createHash } from "node:crypto";

export const FINGERPRINT_SCHEMA = "vaos-attack-fingerprint-v1";

/**
 * Attack class — what kind of activity this fingerprint represents.
 * Stable enum; new entries appended, never reordered or removed.
 */
export type AttackClass =
  | "jailbreak-prompt"
  | "ssrf-probe"
  | "credential-stuffing"
  | "scanner-recon"
  | "injection-attempt"
  | "scraper-abuse"
  | "rate-abuse"
  | "auth-bruteforce";

export interface AttackFingerprint {
  schema: typeof FINGERPRINT_SCHEMA;
  /** ISO-8601 — when the fingerprint was extracted. */
  ts: string;
  /** What kind of attack this represents. */
  class: AttackClass;
  /** TLS JA4 fingerprint when available (Vercel exposes via `x-vercel-ja4`); null otherwise. */
  ja4: string | null;
  /** sha256 of the User-Agent header (truncated to 16 hex). Null when no UA. */
  userAgentDigest: string | null;
  /** sha256 of the request path. Truncated to 16 hex — enough entropy for class-level correlation, low enough that an attacker can't reverse common paths. */
  pathDigest: string;
  /** Method (uppercase). */
  method: string;
  /** sha256 of the payload commitment (e.g. detector signal). Truncated to 16 hex. Optional. */
  payloadDigest: string | null;
  /**
   * 1-3 letter coarse country code (best-effort, from `x-vercel-ip-country`).
   * Country-level only — finer geo would be re-identifying. Null when missing.
   */
  countryHint: string | null;
  /** Severity 0-100. Caller-supplied (typically from the detector). */
  severity: number;
}

/** Pure helper — 16-char truncated sha256 hex of a string. */
function digest16(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
}

export interface ExtractFingerprintInput {
  request: Request;
  attackClass: AttackClass;
  severity: number;
  /** Optional — the payload that triggered detection (sha256-committed, never persisted raw). */
  payload?: string;
}

/**
 * Extract a non-PII attack fingerprint from a Request. Never reads
 * cookies, never reads auth headers, never echoes raw header values
 * into the returned struct.
 */
export function extractAttackFingerprint(
  input: ExtractFingerprintInput,
): AttackFingerprint {
  const url = new URL(input.request.url);
  const headers = input.request.headers;

  // JA4 format allowlist — wave-99 security review H1. JA4 has a
  // fixed alphabet (lowercase hex + underscore). Without this, an
  // adversarial proxy injecting \r\n or other control chars would
  // land verbatim in the published feed envelope.
  const ja4Raw = headers.get("x-vercel-ja4") ?? headers.get("x-ja4") ?? null;
  const ja4 = ja4Raw && /^[a-z0-9_]{1,80}$/i.test(ja4Raw) ? ja4Raw : null;
  const ua = headers.get("user-agent");
  const country =
    headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? null;

  return {
    schema: FINGERPRINT_SCHEMA,
    ts: new Date().toISOString(),
    class: input.attackClass,
    ja4,
    userAgentDigest: ua ? digest16(ua) : null,
    pathDigest: digest16(url.pathname),
    method: input.request.method.toUpperCase(),
    payloadDigest: input.payload ? digest16(input.payload) : null,
    countryHint:
      country &&
      country.length >= 1 &&
      country.length <= 3 &&
      /^[A-Z]+$/.test(country)
        ? country
        : null,
    severity: Math.max(0, Math.min(100, Math.round(input.severity))),
  };
}

/**
 * Stable canonical bytes for a fingerprint — used by the federation
 * bulletin signer and by any verifier reproducing the bulletin hash.
 */
export function canonicalizeFingerprint(f: AttackFingerprint): string {
  return JSON.stringify({
    schema: f.schema,
    ts: f.ts,
    class: f.class,
    ja4: f.ja4,
    userAgentDigest: f.userAgentDigest,
    pathDigest: f.pathDigest,
    method: f.method,
    payloadDigest: f.payloadDigest,
    countryHint: f.countryHint,
    severity: f.severity,
  });
}

/**
 * sha256 hex digest of the canonical bytes — the "fingerprint id"
 * federation members use to dedupe across overlapping reports.
 */
export function fingerprintId(f: AttackFingerprint): string {
  return createHash("sha256")
    .update(canonicalizeFingerprint(f), "utf8")
    .digest("hex");
}
