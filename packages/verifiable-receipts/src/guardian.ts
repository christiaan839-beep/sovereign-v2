/**
 * Guardian rule runner — the pure-OSS half of the Sovereign Matrix
 * Guardian SDK (Wave 17). Customers compose rules into a pack; the
 * runner evaluates them in parallel against a `GuardianContext` and
 * collapses verdicts into a single attestation envelope.
 *
 * The verdict envelope is signed by a caller-supplied `sign()` callback
 * so this module stays free of Node-specific crypto coupling. Use any
 * signer: Node's crypto.sign(Ed25519), HMAC-SHA256, the pq-sign module
 * from this package, or an external KMS / HSM.
 *
 * @packageDocumentation
 */

import { createHash, randomUUID } from "node:crypto";

export type GuardianVerdict = "pass" | "warn" | "block";

export interface GuardianContext {
  runId: string;
  agentSlug: string;
  tokenId?: string;
  input: unknown;
  output: unknown;
}

export interface GuardianRule {
  id: string;
  description: string;
  evaluate: (ctx: GuardianContext) => Promise<{
    verdict: GuardianVerdict;
    reason?: string;
    evidence?: Record<string, unknown>;
  }>;
}

export interface RuleVerdict {
  ruleId: string;
  verdict: GuardianVerdict;
  reason?: string;
  evidence?: Record<string, unknown>;
  durationMs: number;
}

export interface GuardianAttestation {
  verdictId: string;
  overall: GuardianVerdict;
  rules: RuleVerdict[];
  totalMs: number;
  issuedAt: string;
  canonical: string;
  contentHash: string;
  signature: string;
}

/**
 * Run every rule in parallel against the context, collapse the
 * verdicts (block > warn > pass), and sign the envelope.
 *
 * Throwing rules become `warn` verdicts with the error message —
 * rules never break the pipeline.
 */
export async function runGuardian(
  rules: GuardianRule[],
  ctx: GuardianContext,
  sign: (canonical: string) => string,
): Promise<GuardianAttestation> {
  const startedAt = Date.now();
  const verdictId = randomUUID();

  const evaluated: RuleVerdict[] = await Promise.all(
    rules.map(async (rule) => {
      const t = Date.now();
      try {
        const r = await rule.evaluate(ctx);
        return {
          ruleId: rule.id,
          verdict: r.verdict,
          reason: r.reason,
          evidence: r.evidence,
          durationMs: Date.now() - t,
        };
      } catch (err) {
        return {
          ruleId: rule.id,
          verdict: "warn" as const,
          reason: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - t,
        };
      }
    }),
  );

  const overall: GuardianVerdict = evaluated.some((r) => r.verdict === "block")
    ? "block"
    : evaluated.some((r) => r.verdict === "warn")
      ? "warn"
      : "pass";

  const issuedAt = new Date().toISOString();
  const totalMs = Date.now() - startedAt;

  const canonical = canonicalize({
    verdictId,
    runId: ctx.runId,
    agentSlug: ctx.agentSlug,
    tokenId: ctx.tokenId,
    overall,
    rules: evaluated,
    issuedAt,
  });
  const contentHash = sha256(canonical);
  const signature = sign(canonical);

  return {
    verdictId,
    overall,
    rules: evaluated,
    totalMs,
    issuedAt,
    canonical,
    contentHash,
    signature,
  };
}

/**
 * Re-verify a Guardian attestation envelope. Pure — re-derives
 * canonical, checks hash, validates signature via caller-supplied
 * verify().
 */
export function verifyGuardianAttestation(
  attestation: GuardianAttestation,
  verify: (canonical: string, signature: string) => boolean,
): { ok: boolean; reason?: string } {
  // Re-derive canonical from envelope fields. We extract the bound
  // runId / agentSlug / tokenId from the stored canonical rather than
  // separate envelope fields — those WERE bound at issuance.
  const parsed = JSON.parse(attestation.canonical) as {
    runId: string;
    agentSlug: string;
    tokenId?: string | null;
  };
  const recomputed = canonicalize({
    verdictId: attestation.verdictId,
    runId: parsed.runId,
    agentSlug: parsed.agentSlug,
    tokenId: parsed.tokenId ?? undefined,
    overall: attestation.overall,
    rules: attestation.rules,
    issuedAt: attestation.issuedAt,
  });
  if (recomputed !== attestation.canonical) {
    return { ok: false, reason: "canonical-mismatch" };
  }
  if (sha256(recomputed) !== attestation.contentHash) {
    return { ok: false, reason: "hash-mismatch" };
  }
  if (!verify(recomputed, attestation.signature)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  return { ok: true };
}

/**
 * Collapse multiple independently-run verdicts under an M-of-N
 * quorum. Block beats everything; warn requires `required` warns;
 * pass otherwise.
 */
export function quorumCollapse(
  verdicts: GuardianVerdict[],
  required: number,
): GuardianVerdict {
  if (verdicts.some((v) => v === "block")) return "block";
  const warns = verdicts.filter((v) => v === "warn").length;
  if (warns >= required) return "warn";
  return "pass";
}

// ── Built-in rule library ────────────────────────────────────────────

/** Block when the output exceeds maxBytes (scope-drift by volume). */
export function outputSizeRule(maxBytes: number): GuardianRule {
  return {
    id: "output-size",
    description: `Block outputs larger than ${maxBytes} bytes`,
    evaluate: async (ctx) => {
      const size = Buffer.byteLength(JSON.stringify(ctx.output ?? ""), "utf8");
      if (size > maxBytes) {
        return {
          verdict: "block",
          reason: `output ${size}b > limit ${maxBytes}b`,
          evidence: { size, maxBytes },
        };
      }
      return { verdict: "pass" };
    },
  };
}

/** Warn/block on forbidden substrings (PII, brand-ban terms, etc.). */
export function forbiddenSubstringRule(
  needles: string[],
  level: GuardianVerdict = "warn",
): GuardianRule {
  return {
    id: "forbidden-substring",
    description: `${level} when output contains any of [${needles.length} terms]`,
    evaluate: async (ctx) => {
      const text = JSON.stringify(ctx.output ?? "").toLowerCase();
      const hits = needles.filter((n) => text.includes(n.toLowerCase()));
      if (hits.length === 0) return { verdict: "pass" };
      return {
        verdict: level,
        reason: `output contains ${hits.length} forbidden substring(s)`,
        evidence: { hits },
      };
    },
  };
}

/**
 * Require a JIT identity token on every run (Wave-16 invariant from
 * Sovereign Matrix; bring your own token issuance scheme to compose).
 */
export const requireTokenRule: GuardianRule = {
  id: "require-token",
  description: "Block runs that did not carry a JIT identity token",
  evaluate: async (ctx) => {
    if (!ctx.tokenId) {
      return {
        verdict: "block",
        reason: "no JIT token bound to this run",
      };
    }
    return { verdict: "pass" };
  },
};

// ── Internals ─────────────────────────────────────────────────────────

function canonicalize(input: {
  verdictId: string;
  runId: string;
  agentSlug: string;
  tokenId?: string;
  overall: GuardianVerdict;
  rules: RuleVerdict[];
  issuedAt: string;
}): string {
  return JSON.stringify({
    v: 1,
    type: "guardian-verdict",
    verdictId: input.verdictId,
    runId: input.runId,
    agentSlug: input.agentSlug,
    tokenId: input.tokenId ?? null,
    overall: input.overall,
    rules: input.rules
      .slice()
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
      .map((r) => ({
        ruleId: r.ruleId,
        verdict: r.verdict,
        reason: r.reason ?? null,
      })),
    issuedAt: input.issuedAt,
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
