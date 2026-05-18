/**
 * Witness co-signature store — in-memory per-process.
 *
 * Stores a small map of { sthCanonicalHash → list of witness sigs }
 * so a regulator can fetch "all witnesses that have co-signed this
 * tree head". Combined with the demo TransparencyLog this gives the
 * v0.3 witness-aggregator surface from the spec roadmap.
 *
 * In-memory is deliberate for the demo deployment — a real production
 * witness aggregator would back this with Neon. The interface stays
 * the same; only the storage swaps.
 */
import { createHash } from "node:crypto";

export interface WitnessCosignature {
  /** Display name of the witness (e.g. "EU Witness · Berlin"). */
  witnessId: string;
  /** Wire-format signature: v2= or v3= prefix. */
  signature: string;
  /** Time the witness submitted the co-signature (ISO 8601). */
  submittedAt: string;
  /** Optional pubkey URL where verifiers can fetch the witness's PEM. */
  publicKeyUrl?: string;
}

interface StoredEntry {
  sthCanonical: string;
  cosignatures: WitnessCosignature[];
}

const store = new Map<string, StoredEntry>();

/** SHA-256 of the canonical STH bytes — the key for cosignature lookup. */
export function sthKey(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function recordCosignature(
  canonical: string,
  cosig: WitnessCosignature,
): { entry: StoredEntry; created: boolean } {
  const key = sthKey(canonical);
  const existing = store.get(key);
  if (existing) {
    // Idempotent on (witnessId, signature) — a witness re-submitting
    // the same signature is a no-op, not a duplicate.
    const dup = existing.cosignatures.find(
      (c) => c.witnessId === cosig.witnessId && c.signature === cosig.signature,
    );
    if (!dup) {
      existing.cosignatures.push(cosig);
    }
    return { entry: existing, created: false };
  }
  const fresh: StoredEntry = {
    sthCanonical: canonical,
    cosignatures: [cosig],
  };
  store.set(key, fresh);
  return { entry: fresh, created: true };
}

export function getCosignatures(canonical: string): WitnessCosignature[] {
  const entry = store.get(sthKey(canonical));
  return entry ? entry.cosignatures.slice() : [];
}

/** Test helper — clear all stored cosignatures. NEVER call in prod. */
export function _resetWitnessStore(): void {
  store.clear();
}
