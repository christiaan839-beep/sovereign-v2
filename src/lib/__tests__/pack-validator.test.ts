/**
 * vertical-packs/pack-validator (R63) — tests.
 *
 * Pure-function pack-spec validator that ANY third-party pack
 * author must pass before submission. Tests verify each safety
 * invariant catches the corresponding misuse.
 *
 * Covers:
 *   - Structural: version semver, frameworks count, pricing tier
 *   - Read-only ACT scope enforcement (max_cents must be 0)
 *   - Daily limit bounds ($0-$1,000)
 *   - Banned-agent keyword detection (jailbreak, deepfake, etc.)
 *   - HITL rule citation requirement (anti-slop)
 *   - Adverse-action coverage (every reject/deny audit query
 *     needs a HITL rule trigger)
 *   - Audit query audienceContext required
 *   - All 5 in-source vertical packs PASS the validator
 *     (regression-prevention)
 *   - packReadinessScore: 0-100 + blockingErrors
 */

import { describe, it, expect } from "vitest";
import {
  validateAuthoredPack,
  checkAdverseActionCoverage,
  isHitlRuleProperlyCited,
  isAuditQueryProperlyContexted,
  packReadinessScore,
  PACK_SAFETY_INVARIANTS,
} from "../vertical-packs/pack-validator";
import { BANKING_COMPLIANCE_PACK } from "../vertical-packs/banking-compliance";
import { HEALTHCARE_CLAIMS_PACK } from "../vertical-packs/healthcare-claims";
import { LEGAL_DISCOVERY_PACK } from "../vertical-packs/legal-discovery";
import { HR_HIRING_COMPLIANCE_PACK } from "../vertical-packs/hr-hiring-compliance";
import { FEDRAMP_GOVERNMENT_PACK } from "../vertical-packs/fedramp-government";
import type { VerticalPack } from "../vertical-packs/types";

const baseValidPack = (
  override: Partial<VerticalPack> = {},
): VerticalPack => ({
  id: "test-pack-v1",
  name: "Test Pack",
  summary: "A test pack used by the validator unit tests.",
  version: "1.0.0",
  industry: "Testing",
  targetBuyerPersona:
    "Engineering Director or Test Lead at a software company evaluating " +
    "the pack-validator before submitting custom packs to the marketplace.",
  complianceFrameworks: ["soc2-type-ii"],
  enabledAgents: ["test-agent-1"],
  hitlRules: [
    {
      id: "test-rule-1",
      description: "Test HITL rule for validator coverage.",
      trigger: "agent.action == 'test.action'",
      requiredApprovers: 1,
      regulatoryCitation: "INTERNAL_POLICY: pack-author-defined for tests",
    },
  ],
  auditQueries: [
    {
      id: "test-query-1",
      title: "Test Audit Query",
      description: "Test query for validator unit tests.",
      audienceContext: "Internal QA review",
      actionPrefix: "agent.test.",
      defaultWindowDays: 30,
    },
  ],
  slaTier: "standard",
  keyOutcomes: ["test outcome"],
  defaultDailyLimitCents: 5_000,
  defaultActScopes: {
    max_cents: 0,
    actions_allowed: ["agent.read.*"],
  },
  pricingTier: {
    minAcvUsd: 1_000,
    maxAcvUsd: 10_000,
    targetCustomerSize: "Small dev teams",
  },
  ...override,
});

describe("validateAuthoredPack — structural invariants", () => {
  it("accepts a fully-valid pack", () => {
    const r = validateAuthoredPack(baseValidPack());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects pack with non-semver version", () => {
    const r = validateAuthoredPack(baseValidPack({ version: "v1" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HAS_VERSION")).toBe(true);
  });

  it("rejects pack with empty enabledAgents", () => {
    const r = validateAuthoredPack(baseValidPack({ enabledAgents: [] }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HAS_AGENTS")).toBe(true);
  });

  it("rejects pack with empty auditQueries", () => {
    const r = validateAuthoredPack(baseValidPack({ auditQueries: [] }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HAS_AUDIT_QUERIES")).toBe(true);
  });

  it("rejects pack with empty complianceFrameworks", () => {
    const r = validateAuthoredPack(
      baseValidPack({ complianceFrameworks: [] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HAS_FRAMEWORKS")).toBe(true);
  });

  it("rejects pack with too-short targetBuyerPersona", () => {
    const r = validateAuthoredPack(
      baseValidPack({ targetBuyerPersona: "HR" }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HAS_OWNER_FIELD")).toBe(true);
  });
});

describe("validateAuthoredPack — read-only ACT scope (the killer invariant)", () => {
  it("rejects pack with non-zero max_cents (defense in depth)", () => {
    const r = validateAuthoredPack(
      baseValidPack({
        defaultActScopes: {
          max_cents: 1000, // illegal — must be 0
          actions_allowed: ["agent.read.*"],
        },
      }),
    );
    expect(r.ok).toBe(false);
    expect(
      r.errors.some((e) => e.code === "READ_ONLY_DEFAULT_ACT_SCOPE"),
    ).toBe(true);
  });

  it("accepts max_cents: 0 (the canonical safe default)", () => {
    const r = validateAuthoredPack(baseValidPack());
    expect(r.errors.some((e) => e.code === "READ_ONLY_DEFAULT_ACT_SCOPE"))
      .toBe(false);
  });
});

describe("validateAuthoredPack — daily limit bounded", () => {
  it("rejects pack with defaultDailyLimitCents > $1000", () => {
    const r = validateAuthoredPack(
      baseValidPack({ defaultDailyLimitCents: 200_000 }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "DAILY_LIMIT_BOUNDED")).toBe(true);
  });

  it("rejects negative daily limit", () => {
    const r = validateAuthoredPack(
      baseValidPack({ defaultDailyLimitCents: -100 }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "DAILY_LIMIT_BOUNDED")).toBe(true);
  });

  it("accepts $0 (read-only forever) and $1000 (cap boundary)", () => {
    const a = validateAuthoredPack(baseValidPack({ defaultDailyLimitCents: 0 }));
    const b = validateAuthoredPack(
      baseValidPack({ defaultDailyLimitCents: 100_000 }),
    );
    expect(a.errors.some((e) => e.code === "DAILY_LIMIT_BOUNDED")).toBe(false);
    expect(b.errors.some((e) => e.code === "DAILY_LIMIT_BOUNDED")).toBe(false);
  });
});

describe("validateAuthoredPack — banned-agent keywords (anti-abuse)", () => {
  it("rejects pack enabling agents with 'jailbreak' in name", () => {
    const r = validateAuthoredPack(
      baseValidPack({ enabledAgents: ["test-agent-1", "jailbreak-helper"] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "NO_BANNED_AGENTS")).toBe(true);
  });

  it("rejects pack enabling 'deepfake-' agents", () => {
    const r = validateAuthoredPack(
      baseValidPack({ enabledAgents: ["deepfake-creator"] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "NO_BANNED_AGENTS")).toBe(true);
  });

  it("rejects 'spam-blaster' / 'exploit' / 'vote-manipulation' agents", () => {
    for (const banned of [
      "spam-blaster-tool",
      "sql-exploit-runner",
      "vote-manipulation-bot",
    ]) {
      const r = validateAuthoredPack(
        baseValidPack({ enabledAgents: [banned] }),
      );
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.code === "NO_BANNED_AGENTS")).toBe(true);
    }
  });
});

describe("validateAuthoredPack — HITL rule citation (anti-slop)", () => {
  it("rejects HITL rule missing regulatoryCitation", () => {
    const r = validateAuthoredPack(
      baseValidPack({
        hitlRules: [
          {
            id: "no-citation",
            description: "rule with no citation",
            trigger: "x",
            requiredApprovers: 1,
            // regulatoryCitation omitted
          } as never,
        ],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "HITL_RULES_HAVE_CITATIONS")).toBe(
      true,
    );
  });

  it("accepts INTERNAL_POLICY citation for pack-author-defined rules", () => {
    const r = validateAuthoredPack(baseValidPack());
    expect(
      r.errors.some((e) => e.code === "HITL_RULES_HAVE_CITATIONS"),
    ).toBe(false);
  });
});

describe("validateAuthoredPack — adverse-action coverage", () => {
  it("warns when audit query references 'reject' but no HITL rule covers it", () => {
    const r = validateAuthoredPack(
      baseValidPack({
        auditQueries: [
          {
            id: "rejections-query",
            title: "Rejections",
            description: "Query of rejection events",
            audienceContext: "Compliance review",
            actionPrefix: "agent.candidate.reject.",
            defaultWindowDays: 30,
          },
        ],
        hitlRules: [
          {
            id: "unrelated",
            description: "covers something else",
            trigger: "agent.action == 'something.else'",
            requiredApprovers: 1,
            regulatoryCitation: "INTERNAL_POLICY: test",
          },
        ],
      }),
    );
    expect(
      r.warnings.some((w) => w.code === "ADVERSE_ACTIONS_HAVE_HITL"),
    ).toBe(true);
  });

  it("passes when adverse action is covered by HITL trigger", () => {
    const r = validateAuthoredPack(
      baseValidPack({
        auditQueries: [
          {
            id: "rejections-query",
            title: "Rejections",
            description: "Query of rejection events",
            audienceContext: "Compliance review",
            actionPrefix: "agent.candidate.reject.",
            defaultWindowDays: 30,
          },
        ],
        hitlRules: [
          {
            id: "rejection-hitl",
            description: "reject must be HITL",
            trigger: "agent.action == 'candidate.reject.draft'",
            requiredApprovers: 1,
            regulatoryCitation: "Title VII (42 USC 2000e)",
          },
        ],
      }),
    );
    expect(
      r.warnings.some((w) => w.code === "ADVERSE_ACTIONS_HAVE_HITL"),
    ).toBe(false);
  });
});

describe("checkAdverseActionCoverage (pure)", () => {
  it("returns covered:true when no adverse keywords used", () => {
    const r = checkAdverseActionCoverage(baseValidPack());
    expect(r.covered).toBe(true);
    expect(r.uncovered).toEqual([]);
  });

  it("returns uncovered list when keywords appear in queries but no HITL", () => {
    const r = checkAdverseActionCoverage(
      baseValidPack({
        auditQueries: [
          {
            id: "deny-query",
            title: "Denials",
            description: "x",
            audienceContext: "x",
            actionPrefix: "agent.deny.",
            defaultWindowDays: 30,
          },
        ],
      }),
    );
    expect(r.covered).toBe(false);
    expect(r.uncovered).toContain("deny");
  });
});

describe("Helpers: isHitlRuleProperlyCited + isAuditQueryProperlyContexted", () => {
  it("isHitlRuleProperlyCited true when citation present", () => {
    expect(
      isHitlRuleProperlyCited({
        id: "x",
        description: "x",
        trigger: "x",
        requiredApprovers: 1,
        regulatoryCitation: "Title VII",
      }),
    ).toBe(true);
  });

  it("isHitlRuleProperlyCited false when citation missing or too short", () => {
    expect(
      isHitlRuleProperlyCited({
        id: "x",
        description: "x",
        trigger: "x",
        requiredApprovers: 1,
        regulatoryCitation: "x",
      }),
    ).toBe(false);
  });

  it("isAuditQueryProperlyContexted false when audienceContext missing", () => {
    expect(
      isAuditQueryProperlyContexted({
        id: "x",
        title: "x",
        description: "x",
        audienceContext: "",
        actionPrefix: "x.",
        defaultWindowDays: 30,
      }),
    ).toBe(false);
  });
});

describe("packReadinessScore", () => {
  it("returns 100 + ready=true for a fully valid pack", () => {
    const r = packReadinessScore(baseValidPack());
    expect(r.score).toBe(100);
    expect(r.ready).toBe(true);
    expect(r.blockingErrors).toBe(0);
  });

  it("returns lower score + ready=false for invalid pack", () => {
    const r = packReadinessScore(
      baseValidPack({
        defaultActScopes: {
          max_cents: 5000,
          actions_allowed: ["agent.read.*"],
        },
        version: "not-semver",
      }),
    );
    expect(r.score).toBeLessThan(100);
    expect(r.ready).toBe(false);
    expect(r.blockingErrors).toBeGreaterThan(0);
  });
});

describe("REGRESSION: all 5 in-source packs pass the validator", () => {
  it("Banking Compliance Pack passes", () => {
    const r = validateAuthoredPack(BANKING_COMPLIANCE_PACK);
    expect(r.ok).toBe(true);
  });

  it("Healthcare Claims Pack passes", () => {
    const r = validateAuthoredPack(HEALTHCARE_CLAIMS_PACK);
    expect(r.ok).toBe(true);
  });

  it("Legal e-Discovery Pack passes", () => {
    const r = validateAuthoredPack(LEGAL_DISCOVERY_PACK);
    expect(r.ok).toBe(true);
  });

  it("HR Hiring Compliance Pack passes", () => {
    const r = validateAuthoredPack(HR_HIRING_COMPLIANCE_PACK);
    expect(r.ok).toBe(true);
  });

  it("FedRAMP Government Pack passes", () => {
    const r = validateAuthoredPack(FEDRAMP_GOVERNMENT_PACK);
    expect(r.ok).toBe(true);
  });
});

describe("PACK_SAFETY_INVARIANTS — documented + machine-checkable", () => {
  it("each invariant has a non-empty description", () => {
    for (const [key, value] of Object.entries(PACK_SAFETY_INVARIANTS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(20);
      expect(key.length).toBeGreaterThan(2);
    }
  });
});
