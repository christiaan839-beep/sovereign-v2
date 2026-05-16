/**
 * SOVEREIGN MATRIX — Guardian Agent runner (Wave 17, elite-tier).
 *
 * Closes the 2026 research's projected $1B+ "Guardian Agent" market:
 *   "Guardian Agents projected to capture 10–15% of the agentic AI
 *   market by 2030. They monitor subordinate agents for scope drift,
 *   safety failures, hallucinations, and compliance violations."
 *
 * Sovereign already runs 5 internal guardians (NeMo Guardrails, jailbreak
 * detect, content safety, output transparency, quality scorer). This
 * wave exposes the runner surface so customers can plug in their own
 * Guardian, get the same receipt-anchored verdict envelope, and stack
 * verdicts with M-of-N quorum.
 *
 * Wire shape: every verdict is signed with the platform's signRun key
 * so a third party can re-verify the verdict envelope itself, not just
 * the underlying agent output. The verdict becomes an auditable
 * cryptographic artifact, not just a log line.
 *
 * Composes with: src/lib/output-verifier.ts (existing 5-layer pipeline),
 * src/lib/agent-tokens.ts (Wave 16 — token id is bound into the verdict
 * canonical so verdicts cannot be lifted from one run to another).
 */

import { createHash, randomUUID } from "crypto";
import { signRun, verifySignature } from "@/lib/agent-runs";

export type GuardianVerdict = "pass" | "warn" | "block";

export interface GuardianContext {
  /** Run id the Guardian is verifying. */
  runId: string;
  /** Agent slug under inspection. */
  agentSlug: string;
  /** Agent JIT token id from Wave 16, if any. */
  tokenId?: string;
  /** The full agent input bytes. */
  input: unknown;
  /** The agent's output bytes. */
  output: unknown;
}

export interface GuardianRule {
  /** Stable id used in verdict envelope; kebab-case. */
  id: string;
  /** One-line human description. */
  description: string;
  /**
   * Pure function. Return { verdict, reason } for this rule on this
   * context. Throwing is treated as `warn` with the error message.
   */
  evaluate: (ctx: GuardianContext) => Promise<{
    verdict: GuardianVerdict;
    reason?: string;
    /** Optional structured evidence attached to the verdict. */
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
  /** Server-issued uuid for this verdict envelope. */
  verdictId: string;
  /** Highest-severity verdict across all rules; block > warn > pass. */
  overall: GuardianVerdict;
  /** Per-rule results, in evaluation order. */
  rules: RuleVerdict[];
  /** Total time spent evaluating, in ms. */
  totalMs: number;
  /** Issued-at ISO 8601. */
  issuedAt: string;
  /** Deterministic canonical projection (what gets hashed/signed). */
  canonical: string;
  /** SHA-256 of canonical. */
  contentHash: string;
  /** v1=hmac / v2=ed25519 signature over canonical. */
  signature: string;
}

/**
 * Run every rule in parallel against the context, then collapse the
 * verdicts into a single envelope and sign it. Tolerates rule errors
 * (rule throws → verdict=warn with reason=<error>).
 *
 * The envelope is the cryptographic artifact a customer pipes into
 * their workpaper / SIEM / compliance ledger. Verify with
 * `verifyGuardianAttestation()` to confirm it hasn't been mutated.
 */
export async function runGuardian(
  rules: GuardianRule[],
  ctx: GuardianContext,
): Promise<GuardianAttestation> {
  const startedAt = Date.now();
  const verdictId = randomUUID();

  const evaluated = await Promise.all(
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
        } satisfies RuleVerdict;
      } catch (err) {
        return {
          ruleId: rule.id,
          verdict: "warn" as const,
          reason: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - t,
        } satisfies RuleVerdict;
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
  const signature = signRun(canonical);

  // Wave-21 SSE wire-up: emit guardian.verdict.block ONLY when the
  // collapsed verdict is "block" (pass/warn shouldn't page anyone).
  // Lazy-imported; best-effort.
  if (overall === "block") {
    try {
      const firstBlocker = evaluated.find((r) => r.verdict === "block");
      const { publishGuardianBlock } = await import("@/lib/event-bus");
      publishGuardianBlock("*", {
        verdictId,
        agentSlug: ctx.agentSlug,
        ruleId: firstBlocker?.ruleId ?? "unknown",
        reason: firstBlocker?.reason,
      });
    } catch {
      /* non-blocking */
    }
  }

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
 * Re-verify a Guardian verdict envelope: recomputes the canonical
 * from the envelope fields, checks the SHA-256, and validates the
 * signature with the platform's public key. Pure function — no I/O.
 */
export function verifyGuardianAttestation(attestation: GuardianAttestation): {
  ok: boolean;
  reason?: string;
} {
  const recomputed = canonicalize({
    verdictId: attestation.verdictId,
    runId: extractCanonicalField(attestation.canonical, "runId"),
    agentSlug: extractCanonicalField(attestation.canonical, "agentSlug"),
    tokenId: extractCanonicalField(attestation.canonical, "tokenId"),
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
  if (!verifySignature(recomputed, attestation.signature)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  return { ok: true };
}

/**
 * Apply an M-of-N quorum policy across a list of independently-run
 * Guardian verdicts (e.g. tenant Guardian + Sovereign Guardian).
 * Returns "block" if any block; "warn" if `required` warns reached;
 * "pass" otherwise.
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

// ── Built-in rule library — opinionated defaults customers can compose ──

/**
 * Rule: block when the agent output exceeds `maxBytes` (scope drift
 * by volume — an unexpectedly large output is often a token-leak or
 * runaway loop).
 */
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

/**
 * Rule: warn if the output text contains any of the configured
 * forbidden substrings (case-insensitive). Use for PII patterns,
 * confidential class names, or stop-word bans.
 */
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
 * Rule: block when no JIT token id is present on the context. Enforces
 * the Wave-16 identity invariant: every run carries an identity token.
 */
export const requireTokenRule: GuardianRule = {
  id: "require-token",
  description: "Block any run that did not carry a Wave-16 JIT identity token",
  evaluate: async (ctx) => {
    if (!ctx.tokenId) {
      return {
        verdict: "block",
        reason: "no JIT token bound to this run — Wave-16 invariant violated",
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

function extractCanonicalField(canonical: string, field: string): string {
  try {
    const parsed = JSON.parse(canonical) as Record<string, unknown>;
    const v = parsed[field];
    if (v === null || v === undefined) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return "";
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
