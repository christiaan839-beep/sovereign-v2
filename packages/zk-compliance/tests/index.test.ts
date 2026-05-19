/**
 * @sovereign-matrix/zk-compliance tests.
 *
 * Covers:
 *   - Build + verify round-trip
 *   - Every claim-kind aggregate computation
 *   - Verdict assignment per direction (below / above)
 *   - Computation-commitment binding (tampering detection)
 *   - Schema-version recognition
 *   - Receipt-window filtering
 *   - Defensive: malformed input, empty receipt sets
 *   - Markdown + JSON serialization
 */
import { describe, it, expect } from "vitest";
import {
  buildZkProof,
  verifyZkProof,
  toMarkdown,
  toJSON,
  type ComplianceClaim,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 12)}`,
    overall: "pass",
    issuedAt: "2026-03-15T12:00:00Z",
    agentSlug: "agent",
    pack: "test-pack",
    ...overrides,
  } as ReceiptRecord;
}

const WINDOW: Pick<ComplianceClaim, "windowStart" | "windowEnd"> = {
  windowStart: "2026-01-01T00:00:00Z",
  windowEnd: "2026-06-30T23:59:59Z",
};

describe("buildZkProof — structure + schema", () => {
  it("emits stable schema id", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "Block rate is below 1%",
        threshold: 0.01,
        direction: "below",
        ...WINDOW,
      },
      receipts: [],
    });
    expect(proof.schema).toBe("vaos-zk-compliance-v1");
  });

  it("includes zero-knowledge property declaration", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.01,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({})],
    });
    expect(proof.zeroKnowledgeProperties.receiptsRevealed).toBe(0);
    expect(proof.zeroKnowledgeProperties.aggregateRevealed).toBe(1);
    expect(proof.zeroKnowledgeProperties.upgradeToFullZk).toContain("v0.2");
  });
});

describe("buildZkProof — input validation", () => {
  it("throws on NaN threshold", () => {
    expect(() =>
      buildZkProof({
        claim: {
          kind: "block-rate-below-threshold",
          statement: "x",
          threshold: Number.NaN,
          direction: "below",
          ...WINDOW,
        },
        receipts: [],
      }),
    ).toThrow(/threshold must be a finite number/);
  });

  it("throws on infinite threshold", () => {
    expect(() =>
      buildZkProof({
        claim: {
          kind: "block-rate-below-threshold",
          statement: "x",
          threshold: Number.POSITIVE_INFINITY,
          direction: "below",
          ...WINDOW,
        },
        receipts: [],
      }),
    ).toThrow(/finite number/);
  });

  it("throws on invalid ISO-8601 in window", () => {
    expect(() =>
      buildZkProof({
        claim: {
          kind: "block-rate-below-threshold",
          statement: "x",
          threshold: 0.01,
          direction: "below",
          windowStart: "not-a-date",
          windowEnd: "also-not-a-date",
        },
        receipts: [],
      }),
    ).toThrow(/valid ISO-8601/);
  });

  it("throws when windowEnd is before windowStart", () => {
    expect(() =>
      buildZkProof({
        claim: {
          kind: "block-rate-below-threshold",
          statement: "x",
          threshold: 0.01,
          direction: "below",
          windowStart: "2026-06-30T23:59:59Z",
          windowEnd: "2026-01-01T00:00:00Z",
        },
        receipts: [],
      }),
    ).toThrow(/must be after windowStart/);
  });
});

describe("buildZkProof — block-rate-below-threshold", () => {
  it("computes block-rate as fraction of total", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "Block rate ≤ 50%",
        threshold: 0.5,
        direction: "below",
        ...WINDOW,
      },
      receipts: [
        rec({ overall: "pass" }),
        rec({ overall: "pass" }),
        rec({ overall: "block" }),
        rec({ overall: "block" }),
      ],
    });
    expect(proof.revealedAggregate).toBe(0.5); // 2/4 blocks
    expect(proof.verdict).toBe("satisfies-claim"); // 0.5 ≤ 0.5
  });

  it("flags violation when block-rate exceeds threshold", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "Block rate ≤ 10%",
        threshold: 0.1,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({ overall: "block" }), rec({ overall: "pass" })],
    });
    expect(proof.revealedAggregate).toBe(0.5);
    expect(proof.verdict).toBe("violates-claim");
  });
});

describe("buildZkProof — pii-leak-rate-zero", () => {
  it("counts receipts whose rules surface PII / PHI violations", () => {
    const proof = buildZkProof({
      claim: {
        kind: "pii-leak-rate-zero",
        statement: "Zero PII leaks",
        threshold: 0,
        direction: "below",
        ...WINDOW,
      },
      receipts: [
        rec({}), // clean
        rec({
          rules: [{ ruleId: "gdpr-pii-leak-detect", verdict: "block" }],
        }),
        rec({
          rules: [{ ruleId: "hipaa-phi-leak-detect", verdict: "warn" }],
        }),
        rec({
          rules: [{ ruleId: "unrelated-rule", verdict: "block" }],
        }),
      ],
    });
    expect(proof.revealedAggregate).toBeCloseTo(0.5);
    expect(proof.verdict).toBe("violates-claim");
  });

  it("verdict is satisfies when no PII leaks present", () => {
    const proof = buildZkProof({
      claim: {
        kind: "pii-leak-rate-zero",
        statement: "Zero PII leaks",
        threshold: 0,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({}), rec({}), rec({})],
    });
    expect(proof.revealedAggregate).toBe(0);
    expect(proof.verdict).toBe("satisfies-claim");
  });
});

describe("buildZkProof — anomaly-count-below-threshold", () => {
  it("counts receipts with anomalyKind field", () => {
    const proof = buildZkProof({
      claim: {
        kind: "anomaly-count-below-threshold",
        statement: "≤ 3 anomalies",
        threshold: 3,
        direction: "below",
        ...WINDOW,
      },
      receipts: [
        rec({}),
        rec({ anomalyKind: "block-rate-spike" }),
        rec({ anomalyKind: "volume-burst" }),
      ],
    });
    expect(proof.revealedAggregate).toBe(2);
    expect(proof.verdict).toBe("satisfies-claim");
  });
});

describe("buildZkProof — framework-coverage-above-threshold", () => {
  it("counts distinct days in the window", () => {
    const proof = buildZkProof({
      claim: {
        kind: "framework-coverage-above-threshold",
        statement: "≥ 5 days of coverage",
        threshold: 5,
        direction: "above",
        ...WINDOW,
      },
      receipts: [
        rec({ issuedAt: "2026-01-01T08:00:00Z" }),
        rec({ issuedAt: "2026-01-01T20:00:00Z" }),
        rec({ issuedAt: "2026-01-02T12:00:00Z" }),
        rec({ issuedAt: "2026-01-15T12:00:00Z" }),
        rec({ issuedAt: "2026-02-01T12:00:00Z" }),
        rec({ issuedAt: "2026-03-01T12:00:00Z" }),
      ],
    });
    expect(proof.revealedAggregate).toBe(5); // distinct days
    expect(proof.verdict).toBe("satisfies-claim"); // 5 ≥ 5
  });
});

describe("buildZkProof — constitution-articles-honoured", () => {
  it("computes fraction of bound receipts without blocking violations", () => {
    const proof = buildZkProof({
      claim: {
        kind: "constitution-articles-honoured",
        statement: "≥ 95% of bound receipts compliant",
        threshold: 0.95,
        direction: "above",
        ...WINDOW,
      },
      receipts: [
        rec({
          constitutionHash: "abc",
          rules: [{ verdict: "pass" }],
        }),
        rec({
          constitutionHash: "abc",
          rules: [{ verdict: "pass" }],
        }),
        rec({
          constitutionHash: "abc",
          rules: [{ verdict: "block" }],
        }),
        rec({}), // unbound — excluded
      ],
    });
    expect(proof.revealedAggregate).toBeCloseTo(2 / 3);
    expect(proof.verdict).toBe("violates-claim"); // 2/3 < 0.95
  });
});

describe("buildZkProof — window filtering", () => {
  it("excludes receipts outside the audit window", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.5,
        direction: "below",
        windowStart: "2026-06-01T00:00:00Z",
        windowEnd: "2026-06-30T23:59:59Z",
      },
      receipts: [
        rec({ overall: "block", issuedAt: "2026-01-15T12:00:00Z" }), // out
        rec({ overall: "pass", issuedAt: "2026-06-15T12:00:00Z" }), // in
        rec({ overall: "block", issuedAt: "2026-08-15T12:00:00Z" }), // out
      ],
    });
    expect(proof.receiptCount).toBe(1);
    expect(proof.revealedAggregate).toBe(0); // 0 blocks of 1 in-window
  });
});

describe("verifyZkProof — round-trip", () => {
  it("verifies a well-formed proof", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.5,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({ overall: "pass" }), rec({ overall: "block" })],
    });
    const result = verifyZkProof(proof);
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("detects a tampered aggregate", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.5,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({ overall: "block" })],
    });
    // Operator-side tampering: lower the aggregate without recomputing
    // the commitment.
    const tampered = { ...proof, revealedAggregate: 0 };
    const result = verifyZkProof(tampered);
    expect(result.ok).toBe(false);
    expect(
      result.reasons.some((r) => r.includes("computationCommitment")),
    ).toBe(true);
  });

  it("detects a tampered verdict", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.01,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({ overall: "block" })],
    });
    // Original verdict is violates-claim (block-rate 1.0 > 0.01).
    // Operator flips it.
    const tampered = { ...proof, verdict: "satisfies-claim" as const };
    const result = verifyZkProof(tampered);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("verdict mismatch"))).toBe(
      true,
    );
  });

  it("rejects unknown schema version", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.5,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({})],
    });
    const tampered = {
      ...proof,
      schema: "vaos-zk-compliance-future" as never,
    };
    const result = verifyZkProof(tampered);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("Unknown schema"))).toBe(true);
  });
});

describe("buildZkProof — empty receipts", () => {
  it("does not crash; aggregate is 0", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.5,
        direction: "below",
        ...WINDOW,
      },
      receipts: [],
    });
    expect(proof.receiptCount).toBe(0);
    expect(proof.revealedAggregate).toBe(0);
    expect(proof.verdict).toBe("satisfies-claim");
  });
});

describe("toMarkdown + toJSON", () => {
  it("toMarkdown contains every essential section", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "Block rate below 1% over Q2 2026",
        threshold: 0.01,
        direction: "below",
        ...WINDOW,
        citation: "EU AI Act Annex IV §3",
      },
      receipts: [rec({ overall: "pass" })],
    });
    const md = toMarkdown(proof);
    expect(md).toContain("Zero-Knowledge Compliance Proof");
    expect(md).toContain("Block rate below 1% over Q2 2026");
    expect(md).toContain("EU AI Act Annex IV §3");
    expect(md).toContain("SATISFIED");
    expect(md).toContain("Receipts in window");
    expect(md).toContain("Zero-knowledge properties");
    expect(md).toMatch(/[Uu]pgrade/);
  });

  it("toJSON round-trips with stable schema id", () => {
    const proof = buildZkProof({
      claim: {
        kind: "block-rate-below-threshold",
        statement: "x",
        threshold: 0.01,
        direction: "below",
        ...WINDOW,
      },
      receipts: [rec({})],
    });
    const parsed = JSON.parse(toJSON(proof));
    expect(parsed.schema).toBe("vaos-zk-compliance-v1");
    expect(parsed.computationCommitment).toBe(proof.computationCommitment);
  });
});
