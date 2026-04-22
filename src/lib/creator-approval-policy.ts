/**
 * Creator-submission approval policy — Strategy pattern.
 *
 * A submission that has passed SAM v1.0 validation arrives at a second
 * gate: does Sovereign Matrix publish it immediately, or hold it for
 * operator review? The answer depends on the operational posture the
 * marketplace wants to project to the world:
 *
 *   "open"          — NPM / crates.io model. Every SAM-valid manifest
 *                     goes live instantly. Narrative: "ship now, curate
 *                     reactively." Requires a robust takedown workflow.
 *
 *   "curated"       — App Store / Shopify review model. Every
 *                     submission is held for operator review before it
 *                     can list. Narrative: "every agent is vetted."
 *                     Scales linearly with operator hours.
 *
 *   "trust-tiered"  — Hybrid. A creator's first submission is curated.
 *                     Once they have at least one approved agent, later
 *                     submissions auto-publish (with post-hoc audit).
 *                     Narrative: "we verify people, not every agent."
 *                     Scales with unique creators, not submissions.
 *
 * The active policy is read from the `SOVEREIGN_APPROVAL_POLICY` env var
 * on every request. Default is `curated` — the safest launch posture.
 * Flip to `trust-tiered` once operator review is routinely <24h, and
 * flip to `open` only after a takedown workflow is in production.
 *
 * Adding a fourth strategy (e.g. "allowlist") is a matter of (1) adding
 * a value to `ApprovalPolicyName`, (2) writing a Strategy object, (3)
 * registering it in `STRATEGIES`. No changes to call sites.
 */

/* ─── Types ───────────────────────────────────────────────────── */

export type ApprovalPolicyName = "open" | "curated" | "trust-tiered";

export type ApprovalDecisionOutcome = "auto-publish" | "queue";

export interface ApprovalDecision {
  outcome: ApprovalDecisionOutcome;
  /** Short phrase explaining why this outcome was chosen — for audit. */
  reason: string;
  /** Which policy produced this decision — for structured-log attribution. */
  policy: ApprovalPolicyName;
}

export interface ManifestContext {
  slug: string;
  displayName: string;
  category: string;
  /** Manifest.pricing.cents; undefined if the manifest has no pricing block. */
  pricingCents?: number;
}

export interface CreatorContext {
  contactEmail: string | null;
  /**
   * How many agents from this creator have previously been approved.
   *
   * Trust-tiered uses this to decide queue vs auto-publish: 0 means
   * "new creator, route to queue"; ≥1 means "returning creator,
   * auto-publish." Until the creator_submissions table lands this is
   * hardcoded to 0 by callers, which degrades trust-tiered to curated
   * behaviour — safe by default.
   */
  priorApprovedCount: number;
}

interface Strategy {
  readonly name: ApprovalPolicyName;
  evaluate(
    manifest: ManifestContext,
    creator: CreatorContext,
  ): ApprovalDecision;
}

/* ─── Strategies ──────────────────────────────────────────────── */

const openStrategy: Strategy = {
  name: "open",
  evaluate(): ApprovalDecision {
    return {
      outcome: "auto-publish",
      reason: "open policy: all SAM-valid manifests publish immediately",
      policy: "open",
    };
  },
};

const curatedStrategy: Strategy = {
  name: "curated",
  evaluate(): ApprovalDecision {
    return {
      outcome: "queue",
      reason: "curated policy: every submission receives operator review",
      policy: "curated",
    };
  },
};

const trustTieredStrategy: Strategy = {
  name: "trust-tiered",
  evaluate(_manifest, creator): ApprovalDecision {
    if (creator.priorApprovedCount <= 0) {
      return {
        outcome: "queue",
        reason:
          "trust-tiered: first submission from this creator requires operator approval",
        policy: "trust-tiered",
      };
    }
    return {
      outcome: "auto-publish",
      reason: `trust-tiered: creator has ${creator.priorApprovedCount} prior approval(s), auto-publishing with post-hoc audit`,
      policy: "trust-tiered",
    };
  },
};

const STRATEGIES: Readonly<Record<ApprovalPolicyName, Strategy>> = Object.freeze({
  open: openStrategy,
  curated: curatedStrategy,
  "trust-tiered": trustTieredStrategy,
});

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * Resolve the active policy from `process.env.SOVEREIGN_APPROVAL_POLICY`,
 * falling back to `curated` if the env var is missing or invalid.
 *
 * Read on every call (not memoized) so operators can flip the policy via
 * a redeploy without needing a cold start.
 */
export function activePolicyName(): ApprovalPolicyName {
  const raw = process.env.SOVEREIGN_APPROVAL_POLICY;
  if (raw === "open" || raw === "curated" || raw === "trust-tiered") {
    return raw;
  }
  return "curated";
}

/**
 * Look up a strategy by name. Useful for tests that want to exercise a
 * specific policy without touching process.env. Throws if the name is
 * unknown — a programmer error, not a config error.
 */
export function getStrategy(name: ApprovalPolicyName): Strategy {
  const s = STRATEGIES[name];
  if (!s) throw new Error(`Unknown approval policy: ${name}`);
  return s;
}

/**
 * Main entry point. Called from `/api/creators/submit` once the
 * manifest has passed SAM v1.0 validation. Returns the decision record,
 * which the route uses to branch its response (201 live vs 202 queued).
 *
 * @param override  Force a specific policy, ignoring env. For tests only.
 */
export function evaluateSubmission(
  manifest: ManifestContext,
  creator: CreatorContext,
  override?: ApprovalPolicyName,
): ApprovalDecision {
  const name = override ?? activePolicyName();
  return getStrategy(name).evaluate(manifest, creator);
}
