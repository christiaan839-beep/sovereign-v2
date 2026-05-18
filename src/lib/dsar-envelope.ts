/**
 * SOVEREIGN MATRIX — DSAR envelope signing (Wave 13, audit-2026-05).
 *
 * Wraps a Data Subject Access Request (POPIA §23, GDPR Art. 15)
 * export payload with the same cryptographic primitives that sign
 * every receipt, so a regulator handed the export can verify:
 *
 *   1. The export came from this Sovereign Matrix instance (Ed25519
 *      asymmetric signature — public key at
 *      /.well-known/sovereign-receipts/ed25519.pem).
 *   2. The export hasn't been mutated since issuance (SHA-256
 *      content hash bound into the signed canonical projection).
 *   3. The user actually requested the export at the stated time
 *      (canonical projection includes clerkUserId + requestedAt;
 *      the row mirrors into audit_logs and gets anchored into the
 *      daily Bitcoin attestation by Wave 9).
 *
 * Wire layout (returned to caller, embedded in the export JSON):
 *   {
 *     ...exportPayload,
 *     attestation: {
 *       receiptId: uuid,
 *       contentHash: "<sha256 hex of canonical projection>",
 *       signature: "v2=<base64-ed25519>",
 *       issuedAt: ISO8601,
 *       canonical: "<the deterministic JSON string we signed>",
 *       verifyUrl: "/api/dsar/verify/<receiptId>",
 *     }
 *   }
 *
 * The verify URL accepts the receipt id and re-derives the canonical
 * from a fresh DB read, then checks the signature — auditor-replay
 * for the DSAR pipeline.
 */

import { createHash, randomUUID } from "crypto";
import { signRun, verifySignature } from "@/lib/agent-runs";

export interface DsarAttestation {
  /** Server-issued uuid for this DSAR receipt. */
  receiptId: string;
  /** SHA-256 hex of the canonical projection. */
  contentHash: string;
  /** Signature (v1=hmac / v2=ed25519) over the canonical projection. */
  signature: string;
  /** Server timestamp when the attestation was sealed. */
  issuedAt: string;
  /** The canonical projection bytes — auditor can re-hash and verify. */
  canonical: string;
  /** Public verifier endpoint. */
  verifyUrl: string;
}

/**
 * Project a DSAR payload onto a deterministic canonical projection.
 * Walks keys top-down with sorted order so two byte-for-byte
 * identical exports produce byte-for-byte identical signatures.
 */
function canonicalize(input: {
  receiptId: string;
  clerkUserId: string;
  email: string;
  requestedAt: string;
  payloadHash: string;
}): string {
  return JSON.stringify({
    v: 1,
    type: "dsar-export",
    receiptId: input.receiptId,
    clerkUserId: input.clerkUserId,
    email: input.email,
    requestedAt: input.requestedAt,
    payloadHash: input.payloadHash,
  });
}

/**
 * Seal a DSAR export with a cryptographic attestation. Returns the
 * attestation object the caller embeds in the response JSON (typically
 * at `payload.attestation = await signDsarEnvelope(...)`).
 *
 * `payload` is the raw export body — we hash it deterministically
 * (sorted-key SHA-256 over the serialized JSON) so the attestation
 * binds the bytes the user receives, not some other projection.
 */
export function signDsarEnvelope(
  payload: unknown,
  ctx: { clerkUserId: string; email: string },
): DsarAttestation {
  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();
  const payloadHash = sha256(stableStringify(payload));

  const canonical = canonicalize({
    receiptId,
    clerkUserId: ctx.clerkUserId,
    email: ctx.email,
    requestedAt: issuedAt,
    payloadHash,
  });
  const signature = signRun(canonical);
  const contentHash = sha256(canonical);

  return {
    receiptId,
    contentHash,
    signature,
    issuedAt,
    canonical,
    verifyUrl: `/api/dsar/verify/${receiptId}`,
  };
}

/**
 * Re-verify a DSAR attestation given its canonical projection and
 * signature. Returns true iff the signature validates and the embedded
 * payloadHash matches a recomputed hash over the original payload.
 *
 * The caller (the public verify endpoint) re-fetches the original
 * payload from a server-side store, recomputes the payload hash, then
 * passes both into here.
 */
export function verifyDsarEnvelope(
  attestation: DsarAttestation,
  recomputedPayloadHash: string,
): { ok: boolean; reason?: string } {
  // 1. The recomputed payload hash must match what the canonical claims.
  const parsed = JSON.parse(attestation.canonical) as { payloadHash: string };
  if (parsed.payloadHash !== recomputedPayloadHash) {
    return { ok: false, reason: "payload-hash-mismatch" };
  }
  // 2. The signature must validate over the canonical.
  if (!verifySignature(attestation.canonical, attestation.signature)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  // 3. The contentHash must equal a fresh hash over the canonical.
  if (sha256(attestation.canonical) !== attestation.contentHash) {
    return { ok: false, reason: "canonical-hash-mismatch" };
  }
  return { ok: true };
}

/**
 * Stable-stringify — recursively sorts object keys before serialising
 * so logically-identical objects produce byte-identical strings. The
 * same primitive sortKeysDeep used in src/lib/agent-runs.ts.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
