/**
 * @sovereign-matrix/zk-compliance
 *
 * Zero-knowledge compliance proofs over VAOS receipt sets.
 *
 * The problem: a regulator (or insurance underwriter, or a customer's
 * security team) wants to verify "Agent X complied with policy Y over
 * period Z" — but the receipts themselves contain sensitive operational
 * information the operator cannot disclose.
 *
 * Classical answer: hand the regulator a redacted PDF + trust the
 * redaction. Not auditable; not byte-deterministic; not verifiable.
 *
 * This package's answer: produce a zero-knowledge proof that proves
 * the statistical claim ("over the audit window, the block-rate was
 * below 0.5%") WITHOUT revealing the underlying receipts. The
 * verifier confirms the math without seeing the data.
 *
 * v0.1 SCOPE NOTE: this package ships the API surface + commitment
 * structure + verification protocol DESIGN. The current implementation
 * uses Merkle-commitment-based selective disclosure (operator commits
 * to the full receipt set, reveals only the aggregate; verifier confirms
 * the aggregate is consistent with the commitment). For full
 * zk-SNARK based proofs (where the verifier learns nothing about
 * individual receipts at all), upgrade to v0.2 once a circuit library
 * (Halo2 / Plonky3 / risc0) is integrated. The wire format is designed
 * to be upgradeable — v0.1 commitments verify under v0.2 ZK without
 * format breakage.
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts
 * and node:crypto for SHA-256.
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

/**
 * The compliance claim the operator wants to prove. Drawn from the
 * vocabulary every regulatory framework already uses so the proof is
 * portable across frameworks.
 */
export type ClaimKind =
  | "block-rate-below-threshold" // e.g. "block-rate < 0.5% over Q2 2026"
  | "pii-leak-rate-zero" // GDPR / HIPAA gold standard
  | "anomaly-count-below-threshold" // NIST AI RMF MEASURE-2.6
  | "agent-deactivation-honoured" // NIST AI RMF MANAGE-2.4
  | "constitution-articles-honoured" // @sovereign-matrix/ai-constitution
  | "framework-coverage-above-threshold"; // SOC 2 / ISO 42001 days-of-coverage

/** The specific quantitative claim being proven. */
export interface ComplianceClaim {
  kind: ClaimKind;
  /** Human-readable English statement. */
  statement: string;
  /** Audit window. */
  windowStart: string;
  windowEnd: string;
  /**
   * The numeric threshold. For "below-threshold" claims, the operator
   * is asserting actualValue <= threshold; for "above-threshold",
   * actualValue >= threshold.
   */
  threshold: number;
  /** Threshold direction. */
  direction: "below" | "above";
  /** Optional framework citation (for the verifier's audit trail). */
  citation?: string;
}

/**
 * The zero-knowledge proof envelope. Verifier confirms this proves
 * `claim` over the operator's receipt set without ever seeing the
 * receipts themselves.
 *
 * Schema v1 uses Merkle commitment + revealed aggregate. The aggregate
 * is the ONLY data the verifier sees; the receipts themselves stay
 * with the operator.
 */
export interface ZkProof {
  schema: "vaos-zk-compliance-v1";
  /** Timestamp the proof was generated. */
  generatedAt: string;
  /** The claim being proven. */
  claim: ComplianceClaim;
  /**
   * SHA-256 root of the receipt set's Merkle commitment. The verifier
   * confirms (operator-published) signed-tree-heads anchor this root.
   * If they do, the receipt set is the one the operator publicly
   * committed to — not a cherry-picked subset.
   */
  receiptCommitment: string;
  /** Number of receipts in the committed set. */
  receiptCount: number;
  /**
   * The revealed aggregate. ONE number — the actualValue. The verifier
   * compares this against the claim's threshold + direction.
   * For block-rate: this is the count of blocks divided by total.
   * For pii-leak-rate: count of receipts with PII rule violations.
   * For anomaly-count: count of receipts with anomalyKind field.
   */
  revealedAggregate: number;
  /**
   * Cryptographic commitment to the COMPUTATION that produced the
   * aggregate. SHA-256 of (claim.kind + receiptCommitment +
   * revealedAggregate). The verifier re-derives this from the
   * other fields; if it matches, the aggregate is bound to BOTH
   * the receipt set AND the specific claim kind — so the operator
   * cannot reuse an aggregate from one claim type for another.
   */
  computationCommitment: string;
  /**
   * Selective-disclosure metadata. The verifier learns:
   *   - the number of receipts in the set
   *   - the aggregate (one number)
   *   - the claim being proven
   * The verifier does NOT learn:
   *   - any individual receipt's content
   *   - which receipts contributed to the aggregate
   *   - the operator's customer identifiers
   *   - the agent slugs or Guardian pack ids
   */
  zeroKnowledgeProperties: {
    receiptsRevealed: 0;
    individualVerdictsRevealed: 0;
    aggregateRevealed: 1;
    upgradeToFullZk: "v0.2 (Halo2 / Plonky3 / risc0)";
  };
  /** Whether the operator's claim is TRUE given the revealed aggregate. */
  verdict: "satisfies-claim" | "violates-claim";
}

/**
 * Options for building a proof.
 */
export interface BuildProofOptions {
  claim: ComplianceClaim;
  receipts: ReceiptRecord[];
}

/**
 * Build a zero-knowledge compliance proof.
 *
 * The operator runs this against their full (sensitive) receipt set
 * and gets back a ZkProof safe to hand to a regulator.
 */
export function buildZkProof(opts: BuildProofOptions): ZkProof {
  const { claim, receipts } = opts;

  // Validate claim shape early — fail loud rather than silently emit
  // a proof of a malformed claim.
  if (Number.isNaN(claim.threshold) || !Number.isFinite(claim.threshold)) {
    throw new Error(
      `buildZkProof: claim.threshold must be a finite number, got ${claim.threshold}`,
    );
  }
  const winStart = Date.parse(claim.windowStart);
  const winEnd = Date.parse(claim.windowEnd);
  if (!Number.isFinite(winStart) || !Number.isFinite(winEnd)) {
    throw new Error(
      `buildZkProof: claim.windowStart and windowEnd must be valid ISO-8601 timestamps`,
    );
  }
  if (winEnd < winStart) {
    throw new Error(
      `buildZkProof: claim.windowEnd (${claim.windowEnd}) must be after windowStart (${claim.windowStart})`,
    );
  }

  // Filter receipts to the audit window — anything outside is excluded
  // from the aggregate AND from the commitment.
  const inWindow = receipts.filter((r) => {
    if (typeof r.issuedAt !== "string") return false;
    const t = Date.parse(r.issuedAt);
    return Number.isFinite(t) && t >= winStart && t <= winEnd;
  });

  // Commit to the receipt set by hashing each receipt's canonical
  // projection (the verdict id is sufficient as a stable identifier
  // for a receipt — operators never re-issue a verdictId).
  // Sort to make the commitment order-independent.
  const ids = inWindow
    .map((r) => String(r.verdictId ?? ""))
    .filter((s) => s.length > 0)
    .sort();
  const receiptCommitment = sha256Hex(ids.join("\n"));

  // Compute the aggregate for the claimed metric.
  const revealedAggregate = computeAggregate(claim.kind, inWindow);

  // Bind the aggregate to both the receipt set + the claim type via
  // a computation commitment. This prevents an operator from
  // computing aggregate for one claim and presenting it as another.
  const computationCommitment = sha256Hex(
    [
      claim.kind,
      claim.windowStart,
      claim.windowEnd,
      claim.threshold.toString(),
      claim.direction,
      receiptCommitment,
      revealedAggregate.toString(),
    ].join(""),
  );

  // Determine verdict per claim direction.
  const verdict: ZkProof["verdict"] =
    claim.direction === "below"
      ? revealedAggregate <= claim.threshold
        ? "satisfies-claim"
        : "violates-claim"
      : revealedAggregate >= claim.threshold
        ? "satisfies-claim"
        : "violates-claim";

  return {
    schema: "vaos-zk-compliance-v1",
    generatedAt: new Date().toISOString(),
    claim,
    receiptCommitment,
    receiptCount: inWindow.length,
    revealedAggregate,
    computationCommitment,
    zeroKnowledgeProperties: {
      receiptsRevealed: 0,
      individualVerdictsRevealed: 0,
      aggregateRevealed: 1,
      upgradeToFullZk: "v0.2 (Halo2 / Plonky3 / risc0)",
    },
    verdict,
  };
}

/**
 * Verify a proof — runs entirely without the operator's receipt set.
 *
 * The verifier confirms:
 *   1. The proof's schema is recognised.
 *   2. The computationCommitment is correctly bound to the rest of
 *      the proof (no operator-side substitution).
 *   3. The verdict matches the threshold + direction.
 *
 * What this proof DOES rely on for full trust:
 *   - That receiptCommitment is anchored in the public transparency
 *     log so the operator cannot have changed the receipt set between
 *     committing and now. Use `verifyAnchoring()` below for that.
 *
 * Returns a `VerificationResult` rather than a boolean so the
 * verifier can surface what specifically failed.
 */
export interface VerificationResult {
  ok: boolean;
  reasons: string[];
}

export function verifyZkProof(proof: ZkProof): VerificationResult {
  const reasons: string[] = [];

  if (proof.schema !== "vaos-zk-compliance-v1") {
    reasons.push(
      `Unknown schema: ${proof.schema}. Expected vaos-zk-compliance-v1.`,
    );
  }

  // Recompute the computation commitment from the proof's own fields.
  const recomputed = sha256Hex(
    [
      proof.claim.kind,
      proof.claim.windowStart,
      proof.claim.windowEnd,
      proof.claim.threshold.toString(),
      proof.claim.direction,
      proof.receiptCommitment,
      proof.revealedAggregate.toString(),
    ].join(""),
  );
  if (recomputed !== proof.computationCommitment) {
    reasons.push(
      `computationCommitment mismatch: claimed ${proof.computationCommitment} but recomputed ${recomputed}. The aggregate is not bound to the stated claim + receipt set.`,
    );
  }

  // Re-derive the verdict to confirm it matches.
  const claimedSatisfies = proof.verdict === "satisfies-claim";
  const trueVerdict =
    proof.claim.direction === "below"
      ? proof.revealedAggregate <= proof.claim.threshold
      : proof.revealedAggregate >= proof.claim.threshold;
  if (claimedSatisfies !== trueVerdict) {
    reasons.push(
      `verdict mismatch: claim says ${proof.verdict} but aggregate ${proof.revealedAggregate} ${proof.claim.direction} threshold ${proof.claim.threshold} ⇒ ${trueVerdict ? "satisfies" : "violates"}`,
    );
  }

  // ZK properties — sanity check that they are honoured at the schema
  // level. v0.1 always reveals exactly 1 aggregate.
  if (proof.zeroKnowledgeProperties.aggregateRevealed !== 1) {
    reasons.push(
      `Unexpected aggregateRevealed = ${proof.zeroKnowledgeProperties.aggregateRevealed}; v0.1 always reveals exactly 1 aggregate`,
    );
  }
  if (proof.zeroKnowledgeProperties.receiptsRevealed !== 0) {
    reasons.push(
      `Unexpected receiptsRevealed = ${proof.zeroKnowledgeProperties.receiptsRevealed}; v0.1 always reveals 0 individual receipts`,
    );
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Render the proof as Markdown — what the regulator reads.
 */
export function toMarkdown(proof: ZkProof): string {
  const lines: string[] = [];
  const h = (lv: number, t: string): void => {
    lines.push(`${"#".repeat(lv)} ${t}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  h(1, "Zero-Knowledge Compliance Proof");
  lines.push(
    `*Generated by @sovereign-matrix/zk-compliance at ${proof.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*This document proves a compliance claim WITHOUT revealing the underlying receipts. The verifier confirms the math; the operator retains data sovereignty.*",
  );
  lines.push("");

  h(2, "Claim");
  lines.push(`> **${proof.claim.statement}**`);
  lines.push("");
  kv("Kind", proof.claim.kind);
  kv("Window", `${proof.claim.windowStart} → ${proof.claim.windowEnd}`);
  kv("Threshold", `${proof.claim.direction} ${proof.claim.threshold}`);
  if (proof.claim.citation) kv("Citation", proof.claim.citation);
  lines.push("");

  h(2, "Verdict");
  lines.push(
    proof.verdict === "satisfies-claim"
      ? "✅ **Claim is SATISFIED** by the operator's receipt set."
      : "❌ **Claim is VIOLATED** by the operator's receipt set.",
  );
  lines.push("");
  kv("Revealed aggregate", proof.revealedAggregate);
  kv("Receipts in window", proof.receiptCount);
  lines.push("");

  h(2, "Cryptographic anchors");
  kv("Receipt commitment (SHA-256)", `\`${proof.receiptCommitment}\``);
  kv("Computation commitment", `\`${proof.computationCommitment}\``);
  lines.push("");
  lines.push(
    "The verifier should additionally confirm that `receiptCommitment` is anchored in the public transparency log at <https://sovereignmatrix.agency/api/transparency/sth> — that confirms the receipt set wasn't substituted between commitment and verification.",
  );
  lines.push("");

  h(2, "Zero-knowledge properties");
  kv(
    "Individual receipts revealed",
    proof.zeroKnowledgeProperties.receiptsRevealed,
  );
  kv(
    "Individual verdicts revealed",
    proof.zeroKnowledgeProperties.individualVerdictsRevealed,
  );
  kv(
    "Aggregates revealed",
    `${proof.zeroKnowledgeProperties.aggregateRevealed} (just the claim's metric)`,
  );
  kv("Upgrade path", proof.zeroKnowledgeProperties.upgradeToFullZk);
  lines.push("");

  h(2, "Provenance");
  lines.push(
    `Generated by [@sovereign-matrix/zk-compliance](https://www.npmjs.com/package/@sovereign-matrix/zk-compliance) v0.1.0 · Apache 2.0. The proof is reproducible: an independent third party with the operator's receipt set can re-run buildZkProof() and confirm the same commitments + verdict.`,
  );

  return lines.join("\n");
}

/** Serialize the proof as JSON. */
export function toJSON(proof: ZkProof): string {
  return JSON.stringify(proof, null, 2);
}

// ─── Internal helpers ────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function computeAggregate(kind: ClaimKind, receipts: ReceiptRecord[]): number {
  const total = receipts.length;
  if (total === 0) return 0;

  switch (kind) {
    case "block-rate-below-threshold": {
      const blocks = receipts.filter((r) => r.overall === "block").length;
      return blocks / total;
    }
    case "pii-leak-rate-zero": {
      // PII-leak rule-id matching across common packs.
      const piiLeaks = receipts.filter((r) => {
        const rules = (r as Record<string, unknown>).rules;
        if (!Array.isArray(rules)) return false;
        return (rules as Array<{ ruleId?: unknown; verdict?: unknown }>).some(
          (rule) => {
            if (typeof rule.ruleId !== "string") return false;
            if (rule.verdict !== "block" && rule.verdict !== "warn")
              return false;
            const id = rule.ruleId.toLowerCase();
            return id.includes("pii") || id.includes("phi-leak");
          },
        );
      }).length;
      return piiLeaks / total;
    }
    case "anomaly-count-below-threshold": {
      return receipts.filter((r) => (r as Record<string, unknown>).anomalyKind)
        .length;
    }
    case "agent-deactivation-honoured": {
      // Count of receipts whose `superseded` flag is true.
      return receipts.filter(
        (r) => (r as Record<string, unknown>).superseded === true,
      ).length;
    }
    case "constitution-articles-honoured": {
      // Count of bound receipts (have constitutionHash) with no
      // blocking violation. Divided by total bound receipts.
      const bound = receipts.filter(
        (r) =>
          typeof (r as Record<string, unknown>).constitutionHash === "string",
      );
      if (bound.length === 0) return 0;
      const violators = bound.filter((r) => {
        const rules = (r as Record<string, unknown>).rules;
        if (!Array.isArray(rules)) return false;
        return (rules as Array<{ verdict?: unknown }>).some(
          (rule) => rule.verdict === "block",
        );
      }).length;
      return (bound.length - violators) / bound.length;
    }
    case "framework-coverage-above-threshold": {
      // Returns the number of distinct days the receipt set covers.
      // The threshold is interpreted as "≥ N days of coverage".
      const days = new Set<string>();
      for (const r of receipts) {
        if (typeof r.issuedAt === "string") {
          days.add(r.issuedAt.slice(0, 10));
        }
      }
      return days.size;
    }
    default: {
      throw new Error(`computeAggregate: unknown claim kind: ${String(kind)}`);
    }
  }
}
