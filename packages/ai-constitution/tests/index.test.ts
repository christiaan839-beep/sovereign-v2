/**
 * @sovereign-matrix/ai-constitution tests.
 */
import { describe, it, expect } from "vitest";
import {
  buildConstitution,
  verifyConstitutionIntegrity,
  auditAgainstConstitution,
  toMarkdown,
  toJSON,
  canonicalize,
  type ConstitutionArticle,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const ARTICLES: ConstitutionArticle[] = [
  {
    id: "ART-1.1",
    title: "No PHI in outputs",
    text: "The agent SHALL NOT include personally-identifiable health information in any output destined for an end-user channel.",
    severity: "blocking",
    measurableCondition: {
      pack: "hipaaPack",
      ruleId: "hipaa-phi-leak-detect",
    },
    citations: ["HIPAA § 164.502(b)"],
  },
  {
    id: "ART-1.2",
    title: "Cite the source",
    text: "Every factual claim about a patient MUST cite the originating chart entry.",
    severity: "warning",
    measurableCondition: {
      pack: "groundednessPack",
      ruleId: "ground-source-cite",
    },
  },
  {
    id: "ART-2.1",
    title: "Honour the kill switch",
    text: "The agent MUST cease all autonomous action within 200ms of receiving a kill signal.",
    severity: "blocking",
  },
];

describe("buildConstitution — structure", () => {
  it("produces a stable schema id + hash", () => {
    const c = buildConstitution({
      name: "Sample Healthcare Constitution",
      signedBy: "Acme Health AI",
      articles: ARTICLES,
    });
    expect(c.schema).toBe("vaos-constitution-v1");
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("preserves all articles in order", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    expect(c.articles.length).toBe(3);
    expect(c.articles[0]!.id).toBe("ART-1.1");
    expect(c.articles[2]!.id).toBe("ART-2.1");
  });

  it("optionally includes a signature when sign() is provided", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
      sign: (canonical) => `v2=mock-sig-${canonical.length}`,
      publicKey: "----BEGIN PUBLIC KEY---- ...",
    });
    expect(c.signature).toMatch(/^v2=mock-sig-/);
    expect(c.publicKey).toContain("BEGIN PUBLIC KEY");
  });

  it("throws on duplicate article ids", () => {
    expect(() =>
      buildConstitution({
        name: "x",
        signedBy: "y",
        articles: [ARTICLES[0]!, ARTICLES[0]!],
      }),
    ).toThrow(/duplicate article id/);
  });
});

describe("buildConstitution — determinism", () => {
  it("same inputs at the same instant produce the same canonical projection", () => {
    const signedAt = "2026-05-19T12:00:00Z";
    const a = canonicalize(
      { name: "x", signedBy: "y", articles: ARTICLES },
      signedAt,
    );
    const b = canonicalize(
      { name: "x", signedBy: "y", articles: ARTICLES },
      signedAt,
    );
    expect(a).toBe(b);
  });

  it("article-order changes produce different canonical projections", () => {
    const signedAt = "2026-05-19T12:00:00Z";
    const a = canonicalize(
      { name: "x", signedBy: "y", articles: ARTICLES },
      signedAt,
    );
    const reordered = [ARTICLES[1]!, ARTICLES[0]!, ARTICLES[2]!];
    const b = canonicalize(
      { name: "x", signedBy: "y", articles: reordered },
      signedAt,
    );
    expect(a).not.toBe(b);
  });
});

describe("verifyConstitutionIntegrity", () => {
  it("returns true when content matches the embedded hash", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    expect(verifyConstitutionIntegrity(c)).toBe(true);
  });

  it("returns false when articles are tampered with after signing", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    // Mutate an article — hash should no longer match.
    c.articles[0]!.text = "Tampered text.";
    expect(verifyConstitutionIntegrity(c)).toBe(false);
  });

  it("returns false when name is tampered", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    c.name = "Tampered name";
    expect(verifyConstitutionIntegrity(c)).toBe(false);
  });
});

describe("auditAgainstConstitution — receipt binding", () => {
  function rec(
    overrides: Partial<ReceiptRecord> & Record<string, unknown>,
  ): ReceiptRecord {
    return {
      verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
      overall: "pass",
      issuedAt: new Date().toISOString(),
      agentSlug: "test-agent",
      pack: "hipaaPack",
      ...overrides,
    } as ReceiptRecord;
  }

  it("counts receipts bound to the constitution", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({ constitutionHash: c.hash }),
        rec({ constitutionHash: c.hash }),
        rec({ constitutionHash: "other-hash" }),
        rec({}),
      ],
    });
    expect(audit.receiptsBoundToThisConstitution).toBe(2);
    expect(audit.receiptsBoundToDifferentConstitution).toBe(1);
    expect(audit.receiptsUnbound).toBe(1);
  });
});

describe("auditAgainstConstitution — violation detection", () => {
  function rec(
    overrides: Partial<ReceiptRecord> & Record<string, unknown>,
  ): ReceiptRecord {
    return {
      verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
      overall: "pass",
      issuedAt: new Date().toISOString(),
      agentSlug: "test-agent",
      pack: "hipaaPack",
      ...overrides,
    } as ReceiptRecord;
  }

  it("flags blocking violations against the matching article", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: c.hash,
          rules: [
            {
              ruleId: "hipaa-phi-leak-detect",
              pack: "hipaaPack",
              verdict: "block",
            },
          ],
        }),
      ],
    });
    expect(audit.summary.blockingViolationsTotal).toBe(1);
    expect(
      audit.violationsByArticle["ART-1.1"]!.blockingViolations.length,
    ).toBe(1);
  });

  it("flags warning violations against the matching article", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: c.hash,
          rules: [
            {
              ruleId: "ground-source-cite",
              pack: "groundednessPack",
              verdict: "warn",
            },
          ],
        }),
      ],
    });
    expect(audit.summary.warningViolationsTotal).toBe(1);
    expect(audit.violationsByArticle["ART-1.2"]!.warningViolations.length).toBe(
      1,
    );
  });

  it("does not flag receipts whose rules don't match any article", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: c.hash,
          rules: [
            {
              ruleId: "some-unrelated-rule",
              pack: "somepack",
              verdict: "block",
            },
          ],
        }),
      ],
    });
    expect(audit.summary.blockingViolationsTotal).toBe(0);
    expect(audit.summary.warningViolationsTotal).toBe(0);
    expect(audit.summary.cleanReceipts).toBe(1);
  });

  it("does not flag passing rules even when they match an article", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: c.hash,
          rules: [
            {
              ruleId: "hipaa-phi-leak-detect",
              pack: "hipaaPack",
              verdict: "pass",
            },
          ],
        }),
      ],
    });
    expect(audit.summary.blockingViolationsTotal).toBe(0);
    expect(audit.summary.cleanReceipts).toBe(1);
  });

  it("ignores receipts bound to a different constitution", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: "other-hash",
          rules: [
            {
              ruleId: "hipaa-phi-leak-detect",
              pack: "hipaaPack",
              verdict: "block",
            },
          ],
        }),
      ],
    });
    expect(audit.summary.blockingViolationsTotal).toBe(0);
    expect(audit.receiptsBoundToDifferentConstitution).toBe(1);
  });
});

describe("toMarkdown", () => {
  function rec(
    overrides: Partial<ReceiptRecord> & Record<string, unknown>,
  ): ReceiptRecord {
    return {
      verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
      overall: "pass",
      issuedAt: new Date().toISOString(),
      agentSlug: "test-agent",
      pack: "hipaaPack",
      ...overrides,
    } as ReceiptRecord;
  }

  it("emits a structured audit report", () => {
    const c = buildConstitution({
      name: "Sample Healthcare Constitution",
      signedBy: "Acme",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({
      constitution: c,
      receipts: [
        rec({
          constitutionHash: c.hash,
          rules: [
            {
              ruleId: "hipaa-phi-leak-detect",
              pack: "hipaaPack",
              verdict: "block",
            },
          ],
        }),
      ],
    });
    const md = toMarkdown(audit);
    expect(md).toContain("Constitutional AI Audit Report");
    expect(md).toContain("Sample Healthcare Constitution");
    expect(md).toContain("ART-1.1");
    expect(md).toContain("HIPAA § 164.502(b)");
    expect(md).toContain("Provenance");
  });

  it("notes 'no violations detected' when clean", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({ constitution: c, receipts: [] });
    const md = toMarkdown(audit);
    expect(md).toContain("No violations detected");
  });
});

describe("toJSON", () => {
  it("round-trips with stable schema id", () => {
    const c = buildConstitution({
      name: "x",
      signedBy: "y",
      articles: ARTICLES,
    });
    const audit = auditAgainstConstitution({ constitution: c, receipts: [] });
    const json = toJSON(audit);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-constitution-audit-v1");
    expect(parsed.constitutionHash).toBe(c.hash);
  });
});
