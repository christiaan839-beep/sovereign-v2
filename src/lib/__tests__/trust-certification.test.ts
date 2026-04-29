/**
 * certification/trust-certification (R77) — tests.
 *
 * Pure-function tier evaluator. Same inputs → same tier, every time.
 *
 * Covers:
 *   - Empty deployment → uncertified
 *   - Bronze tier requires ALL 4 baseline primitives
 *   - Silver tier requires Bronze + 4 production-safety primitives
 *   - Gold tier requires Silver + 6 auditable-production primitives
 *   - Platinum tier requires Gold + 6 federated-production primitives
 *   - Tier ascending strictness (cannot skip — partial Silver while
 *     missing Bronze → still uncertified)
 *   - countPrimitivesToTier helper
 *   - certificationCompletionPct helper
 *   - Canonical requirement counts in BRONZE/SILVER/GOLD/PLATINUM_REQUIREMENTS
 */

import { describe, it, expect } from "vitest";
import {
  evaluateCertification,
  countPrimitivesToTier,
  certificationCompletionPct,
  BRONZE_REQUIREMENTS,
  SILVER_REQUIREMENTS,
  GOLD_REQUIREMENTS,
  PLATINUM_REQUIREMENTS,
  type DeploymentCapabilities,
} from "../certification/trust-certification";

const emptyDeployment: DeploymentCapabilities = {
  hasHashChainedAuditLog: false,
  hasMultiStageHitl: false,
  hasUserSignedDelegations: false,
  hasCostRunawayCap: false,
  hasCapabilityTokens: false,
  hasCustomerManagedKeys: false,
  hasSingleTurnGuardrails: false,
  hasMultiTurnJailbreakDefense: false,
  hasCustomerAuditExport: false,
  hasSignedReliabilityAttestations: false,
  hasAnomalyDetection: false,
  hasGuardrailsFramework: false,
  hasReputationScoring: false,
  hasTrustAsCollateral: false,
  hasInsuranceUnderwriting: false,
  hasFederationV2: false,
  hasOnChainAnchor: false,
  hasHsmBackedSigning: false,
  hasMultiRegionDeploy: false,
  hasSocTwoTypeTwoAttested: false,
};

const bronzeOnly: DeploymentCapabilities = {
  ...emptyDeployment,
  hasHashChainedAuditLog: true,
  hasMultiStageHitl: true,
  hasUserSignedDelegations: true,
  hasCostRunawayCap: true,
};

const silverOnly: DeploymentCapabilities = {
  ...bronzeOnly,
  hasCapabilityTokens: true,
  hasCustomerManagedKeys: true,
  hasSingleTurnGuardrails: true,
  hasMultiTurnJailbreakDefense: true,
};

const goldOnly: DeploymentCapabilities = {
  ...silverOnly,
  hasCustomerAuditExport: true,
  hasSignedReliabilityAttestations: true,
  hasAnomalyDetection: true,
  hasGuardrailsFramework: true,
  hasReputationScoring: true,
  hasTrustAsCollateral: true,
};

const platinumFull: DeploymentCapabilities = {
  ...goldOnly,
  hasInsuranceUnderwriting: true,
  hasFederationV2: true,
  hasOnChainAnchor: true,
  hasHsmBackedSigning: true,
  hasMultiRegionDeploy: true,
  hasSocTwoTypeTwoAttested: true,
};

describe("Canonical requirement counts", () => {
  it("BRONZE_REQUIREMENTS has exactly 4 entries (R26 + R30 + R33 + R34)", () => {
    expect(BRONZE_REQUIREMENTS).toHaveLength(4);
    const primitives = BRONZE_REQUIREMENTS.map((r) => r.primitive).sort();
    expect(primitives).toEqual(["R26", "R30", "R33", "R34"]);
  });

  it("SILVER_REQUIREMENTS has 4 entries (R37 + R55 + R71 + R73)", () => {
    expect(SILVER_REQUIREMENTS).toHaveLength(4);
  });

  it("GOLD_REQUIREMENTS has 6 entries", () => {
    expect(GOLD_REQUIREMENTS).toHaveLength(6);
  });

  it("PLATINUM_REQUIREMENTS has 6 entries", () => {
    expect(PLATINUM_REQUIREMENTS).toHaveLength(6);
  });

  it("every requirement declares id, description, primitive, required", () => {
    const all = [
      ...BRONZE_REQUIREMENTS,
      ...SILVER_REQUIREMENTS,
      ...GOLD_REQUIREMENTS,
      ...PLATINUM_REQUIREMENTS,
    ];
    for (const r of all) {
      expect(r.id).toBeTruthy();
      expect(r.description.length).toBeGreaterThan(10);
      expect(r.primitive).toBeTruthy();
      expect(typeof r.required).toBe("boolean");
    }
  });
});

describe("evaluateCertification — uncertified base case", () => {
  it("empty deployment → uncertified", () => {
    const r = evaluateCertification(emptyDeployment);
    expect(r.tier).toBe("uncertified");
    expect(r.summary).toContain("UNCERTIFIED");
    expect(r.nextTierGap?.nextTier).toBe("bronze");
    expect(r.nextTierGap?.missing.length).toBe(4);
  });

  it("3 of 4 Bronze primitives → still uncertified (strict)", () => {
    const partial: DeploymentCapabilities = {
      ...emptyDeployment,
      hasHashChainedAuditLog: true,
      hasMultiStageHitl: true,
      hasUserSignedDelegations: true,
      // hasCostRunawayCap still false
    };
    const r = evaluateCertification(partial);
    expect(r.tier).toBe("uncertified");
    expect(r.bronzeStatus.satisfies).toBe(false);
    expect(r.bronzeStatus.missing.some((m) => m.includes("cost-cap"))).toBe(true);
  });
});

describe("evaluateCertification — Bronze tier", () => {
  it("all 4 Bronze primitives → bronze", () => {
    const r = evaluateCertification(bronzeOnly);
    expect(r.tier).toBe("bronze");
    expect(r.bronzeStatus.satisfies).toBe(true);
    expect(r.summary).toContain("BRONZE");
    expect(r.nextTierGap?.nextTier).toBe("silver");
  });

  it("Bronze + 1 Silver primitive (partial Silver) → still bronze", () => {
    const r = evaluateCertification({
      ...bronzeOnly,
      hasCapabilityTokens: true,
      // missing CMEK + guardrails + multi-turn
    });
    expect(r.tier).toBe("bronze");
  });

  it("Bronze tier missing-list shows R-prefixed primitives for next tier", () => {
    const r = evaluateCertification(bronzeOnly);
    const missing = r.nextTierGap?.missing.join(" ") ?? "";
    expect(missing).toMatch(/R37|R55|R71|R73/);
  });
});

describe("evaluateCertification — Silver tier", () => {
  it("Bronze + Silver primitives → silver", () => {
    const r = evaluateCertification(silverOnly);
    expect(r.tier).toBe("silver");
    expect(r.silverStatus.satisfies).toBe(true);
    expect(r.summary).toContain("SILVER");
  });

  it("Silver tier requires multi-turn defense (R73 — anti-slop guard)", () => {
    const noMultiTurn: DeploymentCapabilities = {
      ...silverOnly,
      hasMultiTurnJailbreakDefense: false,
    };
    const r = evaluateCertification(noMultiTurn);
    expect(r.tier).toBe("bronze"); // dropped back to bronze
    expect(r.silverStatus.missing.some((m) => m.includes("multi-turn"))).toBe(
      true,
    );
  });

  it("Silver tier requires CMEK (R55 — HIPAA / financial enterprise gate)", () => {
    const noCmek: DeploymentCapabilities = {
      ...silverOnly,
      hasCustomerManagedKeys: false,
    };
    const r = evaluateCertification(noCmek);
    expect(r.tier).toBe("bronze");
    expect(r.silverStatus.missing.some((m) => m.includes("cmek"))).toBe(true);
  });
});

describe("evaluateCertification — Gold tier", () => {
  it("Silver + Gold primitives → gold", () => {
    const r = evaluateCertification(goldOnly);
    expect(r.tier).toBe("gold");
    expect(r.goldStatus.satisfies).toBe(true);
    expect(r.summary).toContain("GOLD");
  });

  it("Gold requires customer-managed audit export (R45)", () => {
    const noExport: DeploymentCapabilities = {
      ...goldOnly,
      hasCustomerAuditExport: false,
    };
    const r = evaluateCertification(noExport);
    expect(r.tier).toBe("silver");
  });

  it("Gold requires signed reliability attestations (R44)", () => {
    const noAttestations: DeploymentCapabilities = {
      ...goldOnly,
      hasSignedReliabilityAttestations: false,
    };
    const r = evaluateCertification(noAttestations);
    expect(r.tier).toBe("silver");
  });

  it("Gold requires anomaly detection (R57+R67) — full production observability", () => {
    const noAnomaly: DeploymentCapabilities = {
      ...goldOnly,
      hasAnomalyDetection: false,
    };
    const r = evaluateCertification(noAnomaly);
    expect(r.tier).toBe("silver");
  });

  it("Gold requires Trust-as-Collateral live wire (R42+R43)", () => {
    const noTac: DeploymentCapabilities = {
      ...goldOnly,
      hasTrustAsCollateral: false,
    };
    const r = evaluateCertification(noTac);
    expect(r.tier).toBe("silver");
  });
});

describe("evaluateCertification — Platinum tier", () => {
  it("Gold + Platinum primitives → platinum", () => {
    const r = evaluateCertification(platinumFull);
    expect(r.tier).toBe("platinum");
    expect(r.platinumStatus.satisfies).toBe(true);
    expect(r.summary).toContain("PLATINUM");
    expect(r.nextTierGap).toBeNull(); // no next tier
  });

  it("Platinum requires SOC 2 Type II (external attestation)", () => {
    const noSoc2: DeploymentCapabilities = {
      ...platinumFull,
      hasSocTwoTypeTwoAttested: false,
    };
    const r = evaluateCertification(noSoc2);
    expect(r.tier).toBe("gold");
    expect(r.platinumStatus.missing.some((m) => m.includes("soc-2"))).toBe(
      true,
    );
  });

  it("Platinum requires insurance underwriting (R46)", () => {
    const noInsurance: DeploymentCapabilities = {
      ...platinumFull,
      hasInsuranceUnderwriting: false,
    };
    const r = evaluateCertification(noInsurance);
    expect(r.tier).toBe("gold");
  });

  it("Platinum requires federation v2 (R50+R56)", () => {
    const noFederation: DeploymentCapabilities = {
      ...platinumFull,
      hasFederationV2: false,
    };
    const r = evaluateCertification(noFederation);
    expect(r.tier).toBe("gold");
  });

  it("Platinum requires HSM-backed signing (R54 production)", () => {
    const noHsm: DeploymentCapabilities = {
      ...platinumFull,
      hasHsmBackedSigning: false,
    };
    const r = evaluateCertification(noHsm);
    expect(r.tier).toBe("gold");
  });
});

describe("Tier ascending strictness (cannot skip)", () => {
  it("ALL Platinum primitives but ZERO Bronze → uncertified", () => {
    const allUpperOnly: DeploymentCapabilities = {
      ...emptyDeployment,
      // Skip Bronze
      // All Silver
      hasCapabilityTokens: true,
      hasCustomerManagedKeys: true,
      hasSingleTurnGuardrails: true,
      hasMultiTurnJailbreakDefense: true,
      // All Gold
      hasCustomerAuditExport: true,
      hasSignedReliabilityAttestations: true,
      hasAnomalyDetection: true,
      hasGuardrailsFramework: true,
      hasReputationScoring: true,
      hasTrustAsCollateral: true,
      // All Platinum
      hasInsuranceUnderwriting: true,
      hasFederationV2: true,
      hasOnChainAnchor: true,
      hasHsmBackedSigning: true,
      hasMultiRegionDeploy: true,
      hasSocTwoTypeTwoAttested: true,
    };
    const r = evaluateCertification(allUpperOnly);
    // Strict: Bronze must be satisfied first.
    expect(r.tier).toBe("uncertified");
  });
});

describe("countPrimitivesToTier helper", () => {
  it("uncertified deployment needs 4 to reach Bronze", () => {
    const r = evaluateCertification(emptyDeployment);
    expect(countPrimitivesToTier(r, "bronze")).toBe(4);
  });

  it("Bronze deployment needs 4 to reach Silver (the Silver requirement count)", () => {
    const r = evaluateCertification(bronzeOnly);
    expect(countPrimitivesToTier(r, "silver")).toBe(4);
  });

  it("Silver deployment needs 6 to reach Gold (the Gold requirement count)", () => {
    const r = evaluateCertification(silverOnly);
    expect(countPrimitivesToTier(r, "gold")).toBe(6);
  });

  it("Gold deployment needs 6 to reach Platinum (the Platinum requirement count)", () => {
    const r = evaluateCertification(goldOnly);
    expect(countPrimitivesToTier(r, "platinum")).toBe(6);
  });

  it("Platinum deployment needs 0 to reach Platinum", () => {
    const r = evaluateCertification(platinumFull);
    expect(countPrimitivesToTier(r, "platinum")).toBe(0);
  });
});

describe("certificationCompletionPct helper", () => {
  it("empty deployment → 0%", () => {
    const r = evaluateCertification(emptyDeployment);
    expect(certificationCompletionPct(r)).toBe(0);
  });

  it("bronze-only deployment → ~20% (4 of 20)", () => {
    const r = evaluateCertification(bronzeOnly);
    expect(certificationCompletionPct(r)).toBe(20);
  });

  it("silver deployment → 40% (8 of 20)", () => {
    const r = evaluateCertification(silverOnly);
    expect(certificationCompletionPct(r)).toBe(40);
  });

  it("gold deployment → 70% (14 of 20)", () => {
    const r = evaluateCertification(goldOnly);
    expect(certificationCompletionPct(r)).toBe(70);
  });

  it("platinum deployment → 100%", () => {
    const r = evaluateCertification(platinumFull);
    expect(certificationCompletionPct(r)).toBe(100);
  });
});
