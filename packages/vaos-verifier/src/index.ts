/**
 * @sovereign-matrix/vaos-verifier — reference implementation of the
 * Verifiable Agent Output Specification (VAOS) 1.0.
 *
 * Spec: https://sovereignmatrix.agency/spec
 * License: MIT
 *
 * Surface:
 *   - canonicalize(receipt)             — derive the byte-deterministic
 *                                          canonical projection (§6).
 *   - sign(canonical, key)              — produce v1=<hmac> signature (§7).
 *   - verifyLocal(canonical, sig, key)  — local HMAC compare (issuers only;
 *                                          requires the symmetric secret).
 *   - verifyRemote(receipt, endpoint)   — call the issuer's /api/verify
 *                                          (§8); the standard third-party
 *                                          verification path.
 *   - parseSignature(sig)               — extract algorithm + hex payload.
 *
 * Zero dependencies. Works in Node 18+, modern browsers, edge runtimes,
 * and Deno via the Web Crypto API (globalThis.crypto.subtle).
 */

// ─── Types (mirrors VAOS 1.0 §4) ────────────────────────────────────────

export type VaosVisibility = "private" | "public" | "unlisted";
export type VaosTrustDecision = "auto-approved" | "needs-approval" | "blocked";

export interface VaosSafetyResult {
  jailbreak?: "pass" | "fail";
  pii?: "pass" | "fail";
  content?: "pass" | "fail";
  quality?: number;
  critic?: "pass" | "fail";
  /** Implementations MAY include additional sub-fields (§5). */
  [extension: string]: unknown;
}

export interface VaosReceipt {
  id: string;
  agentName: string;
  modelUsed: string;
  input: unknown;
  output: unknown;
  safetyResult: VaosSafetyResult;
  durationMs: number;
  chainDepth?: number;
  trustDecision?: VaosTrustDecision;
  visibility?: VaosVisibility;
  signature: string;
  /** Echoed by the issuer; recompute with `canonicalize()` to verify. */
  canonical?: string;
  createdAt: string | Date;
  /** Implementations MAY include additional fields (§4). */
  [extension: string]: unknown;
}

export interface VerifyResult {
  valid: boolean;
  algorithm: "HMAC-SHA256";
  canonicalVersion: 1;
  id?: string;
  agentName?: string;
  createdAt?: string;
}

// ─── Canonicalization (VAOS §6) ─────────────────────────────────────────

/**
 * Recursively sort object keys so JSON.stringify produces identical
 * output regardless of how the consumer constructed their object literal.
 * Arrays preserve element order — array order IS canonical input (§6.1).
 */
export function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

/**
 * Derive the canonical projection of a Receipt (§6).
 *
 * Top-level field order is locked: v, id, agentName, modelUsed, input,
 * output, safetyResult, durationMs, createdAt. Fields beyond the spec
 * are NOT included.
 */
export function canonicalize(
  receipt: Pick<
    VaosReceipt,
    | "id"
    | "agentName"
    | "modelUsed"
    | "input"
    | "output"
    | "safetyResult"
    | "durationMs"
    | "createdAt"
  >,
): string {
  const createdAt =
    receipt.createdAt instanceof Date
      ? receipt.createdAt.toISOString()
      : receipt.createdAt;
  return JSON.stringify({
    v: 1,
    id: receipt.id,
    agentName: receipt.agentName,
    modelUsed: receipt.modelUsed,
    input: sortKeysDeep(receipt.input),
    output: sortKeysDeep(receipt.output),
    safetyResult: sortKeysDeep(receipt.safetyResult),
    durationMs: receipt.durationMs,
    createdAt,
  });
}

// ─── Signature (VAOS §7) ────────────────────────────────────────────────

const SIGNATURE_PREFIX = "v1=";
const UNSIGNED_SENTINEL = "unsigned";

export interface ParsedSignature {
  algorithm: "v1";
  hex: string;
}

/**
 * Parse a signature string. Returns null for malformed signatures
 * (including the `"unsigned"` sentinel — §7).
 */
export function parseSignature(signature: string): ParsedSignature | null {
  if (!signature || signature === UNSIGNED_SENTINEL) return null;
  if (!signature.startsWith(SIGNATURE_PREFIX)) return null;
  const hex = signature.slice(SIGNATURE_PREFIX.length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  return { algorithm: "v1", hex };
}

/**
 * Compute HMAC-SHA256 of `canonical` under `key` and return the
 * VAOS v1 signature string `"v1=<hex>"` (§7).
 *
 * Issuer-side. Verifiers SHOULD call `verifyRemote()` instead.
 */
export async function sign(
  canonical: string,
  key: string | Uint8Array,
): Promise<string> {
  const hex = await hmacSha256Hex(canonical, key);
  return SIGNATURE_PREFIX + hex;
}

/**
 * Constant-time local verify. Recomputes HMAC and compares to the
 * supplied signature.
 *
 * Issuer-only — requires the symmetric secret. Third parties MUST
 * use `verifyRemote()` to verify against the issuer's endpoint
 * without holding the key.
 */
export async function verifyLocal(
  canonical: string,
  signature: string,
  key: string | Uint8Array,
): Promise<boolean> {
  const parsed = parseSignature(signature);
  if (!parsed) return false;
  const expected = await hmacSha256Hex(canonical, key);
  return constantTimeEqualHex(expected, parsed.hex);
}

// ─── Remote verification (VAOS §8) ──────────────────────────────────────

export interface VerifyRemoteOptions {
  /**
   * Verification endpoint. Defaults to the issuer's standard path
   * `${baseUrl}/api/verify`. Passing an explicit `endpoint` overrides
   * `baseUrl`.
   */
  endpoint?: string;
  baseUrl?: string;
  /** Optional fetch override (for tests / custom transports). */
  fetch?: typeof globalThis.fetch;
  /** Per-request timeout in ms. Defaults to 8000. */
  timeoutMs?: number;
}

/**
 * Verify a Receipt against its issuer's public verification endpoint
 * (§8). The third-party verification path: works without holding the
 * signing key.
 *
 * Steps performed locally before the network call:
 *   1. Re-derive `canonical` from the receipt's data fields.
 *   2. Assert byte-equality against `receipt.canonical` if echoed
 *      (defends against malicious issuer sending a "happy" canonical).
 *   3. POST `{canonical, signature}` to `endpoint`.
 *
 * If the issuer echoes a non-matching canonical, returns
 * `{valid: false}` WITHOUT calling the network — a tampered echo is
 * itself a verification failure.
 */
export async function verifyRemote(
  receipt: VaosReceipt,
  options: VerifyRemoteOptions = {},
): Promise<VerifyResult> {
  const reDerived = canonicalize(receipt);

  if (
    typeof receipt.canonical === "string" &&
    receipt.canonical !== reDerived
  ) {
    return {
      valid: false,
      algorithm: "HMAC-SHA256",
      canonicalVersion: 1,
      id: receipt.id,
      agentName: receipt.agentName,
      createdAt:
        receipt.createdAt instanceof Date
          ? receipt.createdAt.toISOString()
          : receipt.createdAt,
    };
  }

  const endpoint =
    options.endpoint ??
    (options.baseUrl
      ? options.baseUrl.replace(/\/$/, "") + "/api/verify"
      : null);
  if (!endpoint) {
    throw new Error(
      "verifyRemote: must pass either `endpoint` or `baseUrl` in options",
    );
  }

  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 8000);

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        canonical: reDerived,
        signature: receipt.signature,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`verify endpoint returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as Partial<VerifyResult>;
    return {
      valid: !!body.valid,
      algorithm: "HMAC-SHA256",
      canonicalVersion: 1,
      id: body.id,
      agentName: body.agentName,
      createdAt: body.createdAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Crypto helpers ─────────────────────────────────────────────────────

/**
 * Compute lowercase-hex HMAC-SHA256. Uses the Web Crypto API
 * (Node 18+, browsers, edge, Deno) — no Node `crypto` import,
 * so the package runs in every modern JS runtime.
 */
async function hmacSha256Hex(
  message: string,
  key: string | Uint8Array,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "vaos-verifier: globalThis.crypto.subtle unavailable — " +
        "requires Node 18+, modern browser, or edge runtime",
    );
  }
  const enc = new TextEncoder();
  const keyBytes = typeof key === "string" ? enc.encode(key) : key;
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bufToHex(sigBuf);
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    hex += (b < 16 ? "0" : "") + b.toString(16);
  }
  return hex;
}

/**
 * Constant-time equality for two equal-length hex strings.
 * Length mismatch returns false immediately (length is not secret —
 * VAOS signatures are always 64 hex chars).
 */
function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
