/**
 * @sovereign-matrix/agent-sdk — Guardian module.
 *
 * Lets external customers write their own Guardian rules that produce
 * the same cryptographically-signed verdict envelopes Sovereign's
 * internal guardians use. The verdict envelope is independently
 * verifiable so a SIEM / workpaper / compliance ledger can re-check
 * it without trusting the producer.
 *
 * Stable surface — keep additive across SDK minor versions.
 */

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
 * Submit a context + ruleset to Sovereign's `/api/guardian/run`
 * endpoint. The platform evaluates each rule server-side (so the
 * signing key never leaves) and returns the signed attestation.
 *
 * For self-hosted Sovereign instances, point `baseUrl` at your
 * instance and use the `agent:run` + `receipt:issue` scoped JIT
 * token (Wave 16) as the bearer.
 */
export async function submitGuardian(
  rules: GuardianRule[],
  ctx: GuardianContext,
  opts: {
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<GuardianAttestation> {
  const f = opts.fetchImpl ?? fetch;
  const base = (opts.baseUrl ?? "https://sovereignmatrix.agency").replace(
    /\/$/,
    "",
  );
  const res = await f(`${base}/api/guardian/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      ctx,
      ruleDescriptors: rules.map((r) => ({
        id: r.id,
        description: r.description,
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`guardian submit failed: HTTP ${res.status}`);
  }
  return (await res.json()) as GuardianAttestation;
}

/**
 * Quorum combinator — useful when stacking multiple Guardian runs
 * (e.g. tenant-side + Sovereign-side) to require N concurring warns
 * before a block.
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
