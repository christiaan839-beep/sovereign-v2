/**
 * TRUST CERTIFICATION PROGRAM (R77).
 *
 * Pure-function tier evaluator that maps a customer's deployed
 * capabilities to a procurement-readable certification tier:
 * Bronze / Silver / Gold / Platinum.
 *
 * The strategic move: customers who deploy Sovereign Matrix can
 * EARN published certification levels — like SOC 2 Type II
 * attestation but for agentic deployment specifically. They display
 * the certification on RFP responses + procurement collateral, and
 * customers DOWNSTREAM of them can verify the claim via
 * @sovereign/inspector.
 *
 * THE CERTIFICATION TIERS:
 *
 *   Bronze   — basic safety: audit log + HITL + signed delegations
 *   Silver   — production safety: + ACTs + CMEK + multi-turn defense
 *   Gold     — auditable production: + customer audit export +
 *              reliability attestations + anomaly detection +
 *              guardrails framework
 *   Platinum — federated production: + insurance underwriting +
 *              federation v2 + on-chain anchor + HSM signing
 *
 * Composition with R34 CADC: certifications are themselves SIGNED
 * by Sovereign's master signing key + bound to the customer's
 * deployment URL. Customers cannot fabricate higher tiers — the
 * inspector verifies the certification + the underlying primitives
 * offline.
 *
 * Pure-function design throughout. The evaluator takes a
 * capabilities object and returns the tier; no I/O.
 *
 * Same anti-drift pattern as the rest of the trust stack: the
 * required-capabilities matrix lives as TypeScript constants;
 * test cases verify each tier's requirements; anti-drift CI gate
 * verifies the matrix doesn't silently change.
 */

// ── Types ──────────────────────────────────────────────────────────

export type CertificationTier =
  | "uncertified"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

/**
 * Capability flags representing what a customer deployment has
 * shipped + operationally validated. Drawn from the platform's
 * round-numbered primitives.
 */
export interface DeploymentCapabilities {
  // Bronze tier — basic safety
  hasHashChainedAuditLog: boolean; // R26
  hasMultiStageHitl: boolean; // R33
  hasUserSignedDelegations: boolean; // R34 CADC
  hasCostRunawayCap: boolean; // R30

  // Silver tier — production safety
  hasCapabilityTokens: boolean; // R37 ACTs
  hasCustomerManagedKeys: boolean; // R55 CMEK
  hasSingleTurnGuardrails: boolean; // R71 framework
  hasMultiTurnJailbreakDefense: boolean; // R73

  // Gold tier — auditable production
  hasCustomerAuditExport: boolean; // R45
  hasSignedReliabilityAttestations: boolean; // R44
  hasAnomalyDetection: boolean; // R57+R67
  hasGuardrailsFramework: boolean; // R71 with operator adapters
  hasReputationScoring: boolean; // R40
  hasTrustAsCollateral: boolean; // R42+R43

  // Platinum tier — federated production
  hasInsuranceUnderwriting: boolean; // R46
  hasFederationV2: boolean; // R50/R56
  hasOnChainAnchor: boolean; // R59 (future)
  hasHsmBackedSigning: boolean; // R54 production adapter
  hasMultiRegionDeploy: boolean; // R76 (future infra)
  hasSocTwoTypeTwoAttested: boolean; // procurement gate

  // Optional metadata
  deploymentUrl?: string;
  evaluatedAt?: string;
}

/**
 * A single certification requirement that must be satisfied for
 * the tier to be earned.
 */
export interface CertificationRequirement {
  id: string;
  /** Human-readable description for display + audit. */
  description: string;
  /** Reference to the round / primitive that satisfies it. */
  primitive: string;
  /** Whether this capability is required (true) or optional (false). */
  required: boolean;
}

/**
 * The result of evaluating a deployment.
 */
export interface CertificationEvaluation {
  /** The tier the deployment qualifies for. */
  tier: CertificationTier;
  /** Each tier's requirements + whether the deployment meets them. */
  bronzeStatus: TierStatus;
  silverStatus: TierStatus;
  goldStatus: TierStatus;
  platinumStatus: TierStatus;
  /** Human-readable summary. */
  summary: string;
  /** What's needed to advance to the next tier. */
  nextTierGap: { nextTier: CertificationTier; missing: string[] } | null;
  /** ISO 8601 — when this evaluation was performed. */
  evaluatedAt: string;
}

export interface TierStatus {
  tier: CertificationTier;
  satisfies: boolean;
  satisfied: string[];
  missing: string[];
}

// ── Tier requirements (canonical, pure data) ───────────────────────

/**
 * The canonical Bronze-tier requirements. ALL must be satisfied for
 * Bronze certification.
 */
export const BRONZE_REQUIREMENTS: CertificationRequirement[] = [
  {
    id: "audit-chain",
    description: "Hash-chained immutable audit log",
    primitive: "R26",
    required: true,
  },
  {
    id: "hitl",
    description: "Multi-stage human-in-the-loop routing",
    primitive: "R33",
    required: true,
  },
  {
    id: "cadc",
    description: "User-signed agent delegations (Ed25519)",
    primitive: "R34",
    required: true,
  },
  {
    id: "cost-cap",
    description: "Daily cost-runaway protection",
    primitive: "R30",
    required: true,
  },
];

/**
 * Silver tier — Bronze + production-grade safeguards.
 */
export const SILVER_REQUIREMENTS: CertificationRequirement[] = [
  {
    id: "acts",
    description: "Bounded, attenuatable agent capability tokens (Macaroon-pattern)",
    primitive: "R37",
    required: true,
  },
  {
    id: "cmek",
    description: "Customer-managed encryption keys (envelope encryption)",
    primitive: "R55",
    required: true,
  },
  {
    id: "single-turn-guardrails",
    description:
      "Single-turn guardrails framework with operator-pluggable adapters",
    primitive: "R71",
    required: true,
  },
  {
    id: "multi-turn-defense",
    description:
      "Multi-turn jailbreak defender (Cisco-research-driven)",
    primitive: "R73",
    required: true,
  },
];

/**
 * Gold tier — Silver + auditable-production primitives.
 */
export const GOLD_REQUIREMENTS: CertificationRequirement[] = [
  {
    id: "customer-audit-export",
    description: "Customer-managed audit-log export (signed batches)",
    primitive: "R45",
    required: true,
  },
  {
    id: "reliability-attestations",
    description:
      "Cryptographically-signed daily reliability commitments",
    primitive: "R44",
    required: true,
  },
  {
    id: "anomaly-detection",
    description:
      "Real-time statistical anomaly detection cron (R57 + R67)",
    primitive: "R57+R67",
    required: true,
  },
  {
    id: "guardrails-framework-operator-wired",
    description:
      "Operator-built guardrails adapter (NeMo / OpenGuardrails / LlamaFirewall)",
    primitive: "R71 (production)",
    required: true,
  },
  {
    id: "reputation-scoring",
    description: "Public agent reputation scoring",
    primitive: "R40",
    required: true,
  },
  {
    id: "trust-as-collateral",
    description:
      "Trust-as-Collateral live wire (reputation modulates spend cap)",
    primitive: "R42+R43",
    required: true,
  },
];

/**
 * Platinum tier — Gold + federated-production primitives.
 */
export const PLATINUM_REQUIREMENTS: CertificationRequirement[] = [
  {
    id: "insurance-underwriting",
    description:
      "AI agent action insurance with carrier-bound coverage",
    primitive: "R46",
    required: true,
  },
  {
    id: "federation-v2",
    description:
      "Federation v2 cross-instance reputation aggregation",
    primitive: "R50+R56",
    required: true,
  },
  {
    id: "on-chain-anchor",
    description: "On-chain reputation anchor (Bitcoin OP_RETURN / IPFS)",
    primitive: "R59",
    required: true,
  },
  {
    id: "hsm-backed-signing",
    description: "HSM-backed master signing key (operator KMS adapter)",
    primitive: "R54",
    required: true,
  },
  {
    id: "multi-region-deploy",
    description: "Multi-region active-active deployment",
    primitive: "R76 (infra)",
    required: true,
  },
  {
    id: "soc-2-type-2",
    description:
      "SOC 2 Type II attestation completed (3-12 month observation)",
    primitive: "external",
    required: true,
  },
];

// ── Pure-function evaluator ────────────────────────────────────────

/**
 * Evaluate which Bronze requirements the deployment satisfies.
 * Pure function.
 */
function evaluateBronze(c: DeploymentCapabilities): TierStatus {
  const satisfied: string[] = [];
  const missing: string[] = [];
  if (c.hasHashChainedAuditLog) satisfied.push("audit-chain");
  else missing.push("audit-chain (R26)");
  if (c.hasMultiStageHitl) satisfied.push("hitl");
  else missing.push("hitl (R33)");
  if (c.hasUserSignedDelegations) satisfied.push("cadc");
  else missing.push("cadc (R34)");
  if (c.hasCostRunawayCap) satisfied.push("cost-cap");
  else missing.push("cost-cap (R30)");
  return {
    tier: "bronze",
    satisfies: missing.length === 0,
    satisfied,
    missing,
  };
}

function evaluateSilver(c: DeploymentCapabilities): TierStatus {
  const satisfied: string[] = [];
  const missing: string[] = [];
  if (c.hasCapabilityTokens) satisfied.push("acts");
  else missing.push("acts (R37)");
  if (c.hasCustomerManagedKeys) satisfied.push("cmek");
  else missing.push("cmek (R55)");
  if (c.hasSingleTurnGuardrails) satisfied.push("single-turn-guardrails");
  else missing.push("single-turn-guardrails (R71)");
  if (c.hasMultiTurnJailbreakDefense) satisfied.push("multi-turn-defense");
  else missing.push("multi-turn-defense (R73)");
  return {
    tier: "silver",
    satisfies: missing.length === 0,
    satisfied,
    missing,
  };
}

function evaluateGold(c: DeploymentCapabilities): TierStatus {
  const satisfied: string[] = [];
  const missing: string[] = [];
  if (c.hasCustomerAuditExport) satisfied.push("customer-audit-export");
  else missing.push("customer-audit-export (R45)");
  if (c.hasSignedReliabilityAttestations)
    satisfied.push("reliability-attestations");
  else missing.push("reliability-attestations (R44)");
  if (c.hasAnomalyDetection) satisfied.push("anomaly-detection");
  else missing.push("anomaly-detection (R57+R67)");
  if (c.hasGuardrailsFramework)
    satisfied.push("guardrails-framework-operator-wired");
  else
    missing.push("guardrails-framework-operator-wired (R71 production)");
  if (c.hasReputationScoring) satisfied.push("reputation-scoring");
  else missing.push("reputation-scoring (R40)");
  if (c.hasTrustAsCollateral) satisfied.push("trust-as-collateral");
  else missing.push("trust-as-collateral (R42+R43)");
  return {
    tier: "gold",
    satisfies: missing.length === 0,
    satisfied,
    missing,
  };
}

function evaluatePlatinum(c: DeploymentCapabilities): TierStatus {
  const satisfied: string[] = [];
  const missing: string[] = [];
  if (c.hasInsuranceUnderwriting) satisfied.push("insurance-underwriting");
  else missing.push("insurance-underwriting (R46)");
  if (c.hasFederationV2) satisfied.push("federation-v2");
  else missing.push("federation-v2 (R50+R56)");
  if (c.hasOnChainAnchor) satisfied.push("on-chain-anchor");
  else missing.push("on-chain-anchor (R59)");
  if (c.hasHsmBackedSigning) satisfied.push("hsm-backed-signing");
  else missing.push("hsm-backed-signing (R54)");
  if (c.hasMultiRegionDeploy) satisfied.push("multi-region-deploy");
  else missing.push("multi-region-deploy (infra)");
  if (c.hasSocTwoTypeTwoAttested) satisfied.push("soc-2-type-2");
  else missing.push("soc-2-type-2 (external attestation)");
  return {
    tier: "platinum",
    satisfies: missing.length === 0,
    satisfied,
    missing,
  };
}

/**
 * Evaluate the overall tier — strict ascending: a deployment must
 * satisfy ALL of Bronze before Silver counts; ALL of Silver before
 * Gold; etc. This prevents "skipping" tiers via partial implementation.
 *
 * Pure function. Same input → same output, every time.
 */
export function evaluateCertification(
  c: DeploymentCapabilities,
): CertificationEvaluation {
  const bronze = evaluateBronze(c);
  const silver = evaluateSilver(c);
  const gold = evaluateGold(c);
  const platinum = evaluatePlatinum(c);

  let tier: CertificationTier = "uncertified";
  let summary: string;
  let nextTierGap: CertificationEvaluation["nextTierGap"] = null;

  if (!bronze.satisfies) {
    tier = "uncertified";
    summary =
      `UNCERTIFIED — missing ${bronze.missing.length} Bronze requirement(s). ` +
      `Cannot pass procurement compliance review.`;
    nextTierGap = { nextTier: "bronze", missing: bronze.missing };
  } else if (!silver.satisfies) {
    tier = "bronze";
    summary =
      `BRONZE-CERTIFIED — basic agentic safety operational. ` +
      `${silver.missing.length} requirement(s) missing for Silver.`;
    nextTierGap = { nextTier: "silver", missing: silver.missing };
  } else if (!gold.satisfies) {
    tier = "silver";
    summary =
      `SILVER-CERTIFIED — production-grade safety + customer-managed keys. ` +
      `${gold.missing.length} requirement(s) missing for Gold.`;
    nextTierGap = { nextTier: "gold", missing: gold.missing };
  } else if (!platinum.satisfies) {
    tier = "gold";
    summary =
      `GOLD-CERTIFIED — full auditable-production deployment with ` +
      `signed reliability attestations + customer-managed audit export. ` +
      `${platinum.missing.length} requirement(s) missing for Platinum.`;
    nextTierGap = { nextTier: "platinum", missing: platinum.missing };
  } else {
    tier = "platinum";
    summary =
      `PLATINUM-CERTIFIED — federated, insured, hardware-rooted, ` +
      `multi-region. The reference deployment for the agentic AI economy.`;
  }

  return {
    tier,
    bronzeStatus: bronze,
    silverStatus: silver,
    goldStatus: gold,
    platinumStatus: platinum,
    summary,
    nextTierGap,
    evaluatedAt: c.evaluatedAt ?? new Date().toISOString(),
  };
}

/**
 * Pure helper: how many discrete primitives separate the deployment
 * from each tier. Used by /api/certification/status + the dashboard
 * UI to show a progress bar.
 */
export function countPrimitivesToTier(
  evaluation: CertificationEvaluation,
  targetTier: CertificationTier,
): number {
  switch (targetTier) {
    case "bronze":
      return evaluation.bronzeStatus.missing.length;
    case "silver":
      return (
        evaluation.bronzeStatus.missing.length +
        evaluation.silverStatus.missing.length
      );
    case "gold":
      return (
        evaluation.bronzeStatus.missing.length +
        evaluation.silverStatus.missing.length +
        evaluation.goldStatus.missing.length
      );
    case "platinum":
      return (
        evaluation.bronzeStatus.missing.length +
        evaluation.silverStatus.missing.length +
        evaluation.goldStatus.missing.length +
        evaluation.platinumStatus.missing.length
      );
    default:
      return 0;
  }
}

/**
 * Pure helper: classify how many capabilities are operational in
 * percentage terms. Used by procurement-readable summaries.
 */
export function certificationCompletionPct(
  evaluation: CertificationEvaluation,
): number {
  const totalRequirements =
    BRONZE_REQUIREMENTS.length +
    SILVER_REQUIREMENTS.length +
    GOLD_REQUIREMENTS.length +
    PLATINUM_REQUIREMENTS.length;
  const satisfied =
    evaluation.bronzeStatus.satisfied.length +
    evaluation.silverStatus.satisfied.length +
    evaluation.goldStatus.satisfied.length +
    evaluation.platinumStatus.satisfied.length;
  return Math.round((satisfied / totalRequirements) * 100);
}
