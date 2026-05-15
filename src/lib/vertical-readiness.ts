/**
 * SOVEREIGN MATRIX — Vertical readiness scoring (Cook 170).
 *
 * Programmatic 0-100 readiness score per vertical. Makes the
 * marketing-page "we are 100/100 ready for CSRD" claim a
 * verifiable number rather than a marketing assertion.
 *
 * Scoring axes (each contributes a fixed weight):
 *   - Landing page exists                              (10 pts)
 *   - Regulatory pack defined in add-ons.ts            (15 pts)
 *   - Pack mapped to crypto primitives                 (15 pts)
 *   - Compliance framework controls documented         (10 pts)
 *   - Anchor chain recommendation set                  ( 5 pts)
 *   - Retention policy assigned                        ( 5 pts)
 *   - ACV range published                              ( 5 pts)
 *   - Buyer persona documented                         ( 5 pts)
 *   - Use-case workflows documented                    (10 pts)
 *   - Audit-bundle template exists                     (10 pts)
 *   - Auditor Replay Seat enabled                      (10 pts)
 *
 *   Total: 100 pts.
 *
 * Pure module: deterministic over the verticals registry below.
 * The registry is hand-maintained; the verticals page + investor
 * data room read from this single source of truth.
 */

import type { AnchorChain } from "./blockchain-anchor";

// ── Public types ──────────────────────────────────────────────────────────

export type VerticalSlug =
  | "csrd"
  | "banking"
  | "clinical-trials"
  | "pharmacovigilance"
  | "insurance-claims"
  | "utilities"
  | "defense"
  | "tax-audit";

export interface VerticalReadiness {
  slug: VerticalSlug;
  /** Display name shown on /investors + the vertical-page nav. */
  name: string;
  /** Path the landing renders at. */
  landingPath: string;
  /** Regulatory pack id from src/lib/add-ons.ts (if any). */
  packSkuId: string | null;
  /** Stack of crypto primitives that compose this vertical's evidence chain. */
  primitives: string[];
  /** Compliance frameworks the pack maps to. */
  frameworks: string[];
  /** Public chain recommended for anchor publication. */
  anchorChain: AnchorChain;
  /** Retention policy id from src/lib/retention-proof.ts. */
  retentionPolicyId: string;
  /** Annual contract-value range. */
  acvUsd: { low: number; high: number };
  /** Primary buyer persona. */
  buyer: string;
  /** Number of documented use-case workflows on the landing page. */
  workflowsDocumented: number;
  /** Audit-bundle template id (null if not yet shipped). */
  auditBundleTemplate: string | null;
  /** Whether Auditor Replay Seat (Cook 136) is offered. */
  replaySeatEnabled: boolean;
}

export interface ReadinessScore {
  slug: VerticalSlug;
  name: string;
  score: number;
  breakdown: Record<string, number>;
  missing: string[];
}

// ── Canonical registry ────────────────────────────────────────────────────

export const VERTICALS: Record<VerticalSlug, VerticalReadiness> = {
  csrd: {
    slug: "csrd",
    name: "EU CSRD / ESRS",
    landingPath: "/for-csrd",
    packSkuId: "regulatory-pack-csrd",
    primitives: [
      "model-fingerprint",
      "receipt-chain",
      "merkle-receipt-batch",
      "anon-credential",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "EU CSRD",
      "ESRS E1-E5",
      "ESRS S1-S4",
      "ESRS G1",
      "ISSA 5000",
      "GRI",
      "TCFD",
      "ISO 14064",
    ],
    anchorChain: "ethereum-mainnet",
    retentionPolicyId: "csrd-7yr",
    acvUsd: { low: 250_000, high: 400_000 },
    buyer: "Big-4 Sustainability Assurance partner",
    workflowsDocumented: 3,
    auditBundleTemplate: "csrd-quarterly",
    replaySeatEnabled: true,
  },
  banking: {
    slug: "banking",
    name: "Banking / SR 11-7",
    landingPath: "/for-banking",
    packSkuId: "regulatory-pack-sr11-7",
    primitives: [
      "model-fingerprint",
      "receipt-chain",
      "receipt-ratchet",
      "drift-detector",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "Fed SR 11-7",
      "PRA SS1/23",
      "EBA TRIM",
      "ECOA",
      "FCRA",
      "BSA / AML",
      "EU AI Act Annex III",
      "SOC 2 Type 2",
    ],
    anchorChain: "bitcoin-mainnet",
    retentionPolicyId: "fed-sr11-7-10yr",
    acvUsd: { low: 150_000, high: 350_000 },
    buyer: "Chief Model Risk Officer",
    workflowsDocumented: 3,
    auditBundleTemplate: "sr11-7-quarterly",
    replaySeatEnabled: true,
  },
  "clinical-trials": {
    slug: "clinical-trials",
    name: "Clinical Trials / 21 CFR Part 11",
    landingPath: "/for-clinical-trials",
    packSkuId: "regulatory-pack-part-11",
    primitives: [
      "multi-party-attestation",
      "receipt-chain",
      "receipt-ratchet",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "ICH GCP E6(R3)",
      "21 CFR Part 11",
      "21 CFR Part 50",
      "21 CFR Part 56",
      "EU CTR 536/2014",
      "ALCOA+",
      "EMA / FDA BIMO",
      "HIPAA",
      "GDPR",
    ],
    anchorChain: "ethereum-mainnet",
    retentionPolicyId: "part-11-trial-end-plus-2yr",
    acvUsd: { low: 300_000, high: 600_000 },
    buyer: "Head of QA / Clinical Operations",
    workflowsDocumented: 3,
    auditBundleTemplate: "part-11-bimo",
    replaySeatEnabled: true,
  },
  pharmacovigilance: {
    slug: "pharmacovigilance",
    name: "Pharmacovigilance / ICH E2B",
    landingPath: "/for-pharmacovigilance",
    packSkuId: "regulatory-pack-part-11",
    primitives: [
      "hallucination-detector",
      "receipt-chain",
      "receipt-ratchet",
      "multi-party-attestation",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "ICH E2B(R3)",
      "ICH E2D",
      "ICH E2E",
      "ICH E2F",
      "EU GVP I-XVI",
      "FDA 21 CFR 314.80",
      "21 CFR Part 11",
      "FDA BIMO",
    ],
    anchorChain: "ethereum-mainnet",
    retentionPolicyId: "pv-25yr",
    acvUsd: { low: 250_000, high: 500_000 },
    buyer: "Head of Pharmacovigilance",
    workflowsDocumented: 3,
    auditBundleTemplate: "pv-quarterly",
    replaySeatEnabled: true,
  },
  "insurance-claims": {
    slug: "insurance-claims",
    name: "Insurance Claims / NAIC AI Bias",
    landingPath: "/for-insurance-claims",
    packSkuId: null, // bundled into regulatory packs roadmap
    primitives: [
      "bias-auditor",
      "receipt-chain",
      "drift-detector",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "NAIC AI/ML Bulletin",
      "NY DFS Reg 121",
      "CO DOI Reg 10-1-1",
      "ERISA §503 / §1133",
      "HIPAA",
      "Fair Claims Settlement",
      "ECOA",
      "SOC 2 Type 2",
    ],
    anchorChain: "bitcoin-mainnet",
    retentionPolicyId: "default-90d",
    acvUsd: { low: 200_000, high: 500_000 },
    buyer: "AVP Claims / Chief Compliance Officer",
    workflowsDocumented: 3,
    auditBundleTemplate: null,
    replaySeatEnabled: true,
  },
  utilities: {
    slug: "utilities",
    name: "Utilities / NERC CIP",
    landingPath: "/for-utilities",
    packSkuId: "regulatory-pack-nerc-cip",
    primitives: [
      "receipt-chain",
      "receipt-ratchet",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "NERC CIP-002 through CIP-014",
      "FERC Order 2222",
      "EU CSRD / ESRS",
      "TCFD",
      "ISO 14064",
      "SOX 404",
      "NIST SP 800-82",
      "SOC 2 Type 2",
    ],
    anchorChain: "bitcoin-mainnet",
    retentionPolicyId: "csrd-7yr",
    acvUsd: { low: 400_000, high: 800_000 },
    buyer: "CISO / NERC Compliance Director",
    workflowsDocumented: 3,
    auditBundleTemplate: "nerc-cip-quarterly",
    replaySeatEnabled: true,
  },
  defense: {
    slug: "defense",
    name: "Defense / FedRAMP",
    landingPath: "/for-defense",
    packSkuId: "regulatory-pack-fedramp",
    primitives: [
      "model-fingerprint",
      "receipt-chain",
      "envelope-encryption",
      "merkle-receipt-batch",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "FedRAMP Moderate",
      "FISMA",
      "NIST SP 800-53",
      "NIST AI RMF",
      "DFARS 252.204-7012",
      "OMB M-24-10",
      "SOC 2 Type 2",
    ],
    anchorChain: "bitcoin-mainnet",
    retentionPolicyId: "fedramp-3yr",
    acvUsd: { low: 500_000, high: 2_000_000 },
    buyer: "Federal CTO / Defense procurement",
    workflowsDocumented: 3,
    auditBundleTemplate: null,
    replaySeatEnabled: true,
  },
  "tax-audit": {
    slug: "tax-audit",
    name: "Tax Audit Defense",
    landingPath: "/for-tax-audit",
    packSkuId: null,
    primitives: [
      "receipt-chain",
      "anon-credential",
      "retention-proof",
      "blockchain-anchor",
    ],
    frameworks: [
      "IRS Circular 230",
      "EU DAC7",
      "OECD Pillar Two",
      "SOC 2 Type 2",
    ],
    anchorChain: "ethereum-mainnet",
    retentionPolicyId: "default-90d",
    acvUsd: { low: 300_000, high: 600_000 },
    buyer: "Big-4 Tax Partner",
    workflowsDocumented: 3,
    auditBundleTemplate: null,
    replaySeatEnabled: true,
  },
};

// ── Scoring ───────────────────────────────────────────────────────────────

const WEIGHTS = {
  landing: 10,
  pack: 15,
  primitives: 15,
  frameworks: 10,
  anchor: 5,
  retention: 5,
  acv: 5,
  buyer: 5,
  workflows: 10,
  auditBundle: 10,
  replaySeat: 10,
};

/**
 * Score one vertical's readiness on a 0-100 scale.
 * Pure: deterministic, no I/O.
 */
export function scoreVertical(v: VerticalReadiness): ReadinessScore {
  const breakdown: Record<string, number> = {};
  const missing: string[] = [];

  breakdown.landing = v.landingPath ? WEIGHTS.landing : 0;
  if (!v.landingPath) missing.push("landing page");

  breakdown.pack = v.packSkuId ? WEIGHTS.pack : 0;
  if (!v.packSkuId) missing.push("regulatory pack SKU");

  // Primitives: full credit at 5+ primitives, scaled below.
  breakdown.primitives = Math.min(
    WEIGHTS.primitives,
    Math.round((v.primitives.length / 5) * WEIGHTS.primitives),
  );
  if (v.primitives.length < 5)
    missing.push(`${5 - v.primitives.length} more crypto primitive(s)`);

  // Frameworks: full credit at 6+ documented.
  breakdown.frameworks = Math.min(
    WEIGHTS.frameworks,
    Math.round((v.frameworks.length / 6) * WEIGHTS.frameworks),
  );
  if (v.frameworks.length < 6)
    missing.push(`${6 - v.frameworks.length} more framework mapping(s)`);

  breakdown.anchor = v.anchorChain ? WEIGHTS.anchor : 0;
  if (!v.anchorChain) missing.push("blockchain anchor chain assignment");

  breakdown.retention = v.retentionPolicyId ? WEIGHTS.retention : 0;
  if (!v.retentionPolicyId) missing.push("retention policy assignment");

  breakdown.acv =
    v.acvUsd.low > 0 && v.acvUsd.high > v.acvUsd.low ? WEIGHTS.acv : 0;
  if (!(v.acvUsd.low > 0 && v.acvUsd.high > v.acvUsd.low))
    missing.push("ACV range");

  breakdown.buyer = v.buyer ? WEIGHTS.buyer : 0;
  if (!v.buyer) missing.push("buyer persona");

  // Workflows: full credit at 3+ documented.
  breakdown.workflows = Math.min(
    WEIGHTS.workflows,
    Math.round((v.workflowsDocumented / 3) * WEIGHTS.workflows),
  );
  if (v.workflowsDocumented < 3)
    missing.push(`${3 - v.workflowsDocumented} more workflow(s) documented`);

  breakdown.auditBundle = v.auditBundleTemplate ? WEIGHTS.auditBundle : 0;
  if (!v.auditBundleTemplate) missing.push("audit-bundle template");

  breakdown.replaySeat = v.replaySeatEnabled ? WEIGHTS.replaySeat : 0;
  if (!v.replaySeatEnabled) missing.push("Auditor Replay Seat enablement");

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    slug: v.slug,
    name: v.name,
    score,
    breakdown,
    missing,
  };
}

/** Score every vertical in the registry. */
export function scoreAllVerticals(): ReadinessScore[] {
  return Object.values(VERTICALS).map(scoreVertical);
}

/**
 * Compute the platform-wide readiness — the average across
 * every vertical. The number you show on /investors as the
 * "platform-level readiness" headline.
 */
export function platformReadiness(): { avg: number; min: number; max: number } {
  const scores = scoreAllVerticals().map((s) => s.score);
  if (scores.length === 0) return { avg: 0, min: 0, max: 0 };
  const sum = scores.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / scores.length),
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
}

/**
 * Find every gap the platform still needs to fill to hit
 * 100/100 across all verticals. Caller uses this as the
 * roadmap punch list for "make every vertical 100/100".
 */
export function platformGaps(): Array<{
  slug: VerticalSlug;
  missing: string[];
}> {
  return scoreAllVerticals()
    .filter((s) => s.missing.length > 0)
    .map((s) => ({ slug: s.slug, missing: s.missing }));
}
