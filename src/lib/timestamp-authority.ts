/**
 * SOVEREIGN MATRIX — Timestamp authority chaining (Cook 105).
 *
 * Defense-in-depth: every receipt gets notarized to multiple
 * independent timestamp authorities (TSAs) so no single TSA failure
 * invalidates an audit trail. Production wires OpenTimestamps +
 * Algorand inclusion proof; tests inject deterministic mocks.
 *
 * Pure module — caller supplies the actual TSA submit/verify
 * functions via injection. The module owns the orchestration:
 * fan-out, deduplication on receipt hash, structured failure outcomes.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface TsaProof {
  authority: string;
  /** Opaque proof blob the TSA returned. */
  proof: string;
  /** Unix ms when the TSA accepted the submission. */
  notarizedAt: number;
}

export interface NotarizationResult {
  /** Hex receipt hash that was notarized. */
  receiptHash: string;
  proofs: TsaProof[];
  failures: Array<{ authority: string; message: string }>;
  /** True iff at least 1 TSA accepted. */
  ok: boolean;
}

export interface VerificationResult {
  authority: string;
  /** True iff the proof matched the receipt hash for this TSA. */
  valid: boolean;
  message?: string;
}

export interface TsaClient {
  /** Stable identifier ("opentimestamps", "algorand", "sia", ...). */
  name: string;
  /** Submit a receipt hash; return an opaque proof. */
  submit: (receiptHash: string) => Promise<string>;
  /** Verify a previously-issued proof against a receipt hash. */
  verify: (receiptHash: string, proof: string) => Promise<boolean>;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Notarize a receipt hash across every configured TSA in parallel.
 * Tolerates partial failure — caller decides the quorum policy.
 * Returns proofs from successful TSAs + structured failures.
 */
export async function notarize(
  receiptHash: string,
  clients: TsaClient[],
): Promise<NotarizationResult> {
  if (!/^[a-f0-9]{32,128}$/i.test(receiptHash)) {
    throw new Error("notarize: receiptHash must be hex (32-128 chars)");
  }
  if (clients.length === 0) {
    return {
      receiptHash,
      proofs: [],
      failures: [],
      ok: false,
    };
  }

  const results = await Promise.all(
    clients.map(async (c) => {
      try {
        const proof = await c.submit(receiptHash);
        return {
          ok: true as const,
          authority: c.name,
          proof,
          notarizedAt: Date.now(),
        };
      } catch (err) {
        return {
          ok: false as const,
          authority: c.name,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const proofs: TsaProof[] = [];
  const failures: Array<{ authority: string; message: string }> = [];
  for (const r of results) {
    if (r.ok) {
      proofs.push({
        authority: r.authority,
        proof: r.proof,
        notarizedAt: r.notarizedAt,
      });
    } else {
      failures.push({ authority: r.authority, message: r.message });
    }
  }
  return {
    receiptHash,
    proofs,
    failures,
    ok: proofs.length > 0,
  };
}

/**
 * Verify every proof in a notarization result. Returns per-TSA
 * verdicts so the caller can apply M-of-N quorum.
 */
export async function verifyAll(
  receiptHash: string,
  proofs: TsaProof[],
  clients: TsaClient[],
): Promise<VerificationResult[]> {
  const byName = new Map(clients.map((c) => [c.name, c]));
  const results: VerificationResult[] = [];
  await Promise.all(
    proofs.map(async (p) => {
      const c = byName.get(p.authority);
      if (!c) {
        results.push({
          authority: p.authority,
          valid: false,
          message: "Unknown authority — no verifier registered",
        });
        return;
      }
      try {
        const valid = await c.verify(receiptHash, p.proof);
        results.push({ authority: p.authority, valid });
      } catch (err) {
        results.push({
          authority: p.authority,
          valid: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  return results;
}

/**
 * Apply an M-of-N quorum policy to a list of verification results.
 * Returns true iff at least `required` valid verdicts are present.
 */
export function quorumOk(
  results: VerificationResult[],
  required: number,
): boolean {
  if (required <= 0) return true;
  return results.filter((r) => r.valid).length >= required;
}
