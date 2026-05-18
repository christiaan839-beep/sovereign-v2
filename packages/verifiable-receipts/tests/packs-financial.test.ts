/**
 * Guardian rule packs — CFPB / MAS / FCA (financial regulators).
 *
 * Each pack is unit-tested for its positive AND negative cases so
 * an issuer adopting the pack doesn't have to guess what the rule
 * trips on. Tests double as documentation for the regulatory clauses
 * each rule cites.
 */
import { describe, it, expect } from "vitest";
import {
  cfpbRules,
  cfpbPack,
  masRules,
  masPack,
  fcaRules,
  fcaPack,
  ALL_PACKS,
} from "../src/packs.js";
import type { GuardianRule } from "../src/guardian.js";

function findRule(rules: GuardianRule[], id: string): GuardianRule {
  const r = rules.find((rule) => rule.id === id);
  if (!r) throw new Error(`rule not found: ${id}`);
  return r;
}

async function evalAt(
  rule: GuardianRule,
  output: unknown,
  input: unknown = {},
  extra: Record<string, unknown> = {},
) {
  return rule.evaluate({
    runId: "test-run",
    agentSlug: "test-agent",
    tokenId: "test-tok",
    input,
    output,
    ...extra,
  });
}

describe("CFPB pack — ECOA / Reg Z", () => {
  it("registers in ALL_PACKS with citation + 3 rules", () => {
    expect(ALL_PACKS.some((p) => p.id === cfpbPack.id)).toBe(true);
    expect(cfpbPack.rules.length).toBe(3);
    expect(cfpbPack.citation).toMatch(/12 CFR/);
  });

  it("BLOCKS an adverse-action output with no rationale", async () => {
    const rule = findRule(cfpbRules, "cfpb-adverse-action-rationale");
    const v = await evalAt(rule, "Application denied.");
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/ECOA/);
  });

  it("PASSES an adverse-action output with rationale", async () => {
    const rule = findRule(cfpbRules, "cfpb-adverse-action-rationale");
    const v = await evalAt(
      rule,
      "Application denied because of insufficient income and the principal reason is debt-to-income ratio above 50%.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS a denial that cites a protected class", async () => {
    const rule = findRule(cfpbRules, "cfpb-no-protected-class-as-factor");
    const v = await evalAt(
      rule,
      "Application denied due to applicant's age 67 and marital status.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/protected class/i);
  });

  it("PASSES an approval with no protected-class reference", async () => {
    const rule = findRule(cfpbRules, "cfpb-no-protected-class-as-factor");
    const v = await evalAt(rule, "Application approved at standard APR.");
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on mortgage output without APR disclosure", async () => {
    const rule = findRule(cfpbRules, "cfpb-ufmip-disclosure");
    const v = await evalAt(rule, "30-year mortgage at 6.5% interest");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES a mortgage output that includes APR", async () => {
    const rule = findRule(cfpbRules, "cfpb-ufmip-disclosure");
    const v = await evalAt(
      rule,
      "30-year mortgage at 6.5% interest, APR 6.78%",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("MAS pack — FEAT Principles + PDPA", () => {
  it("registers in ALL_PACKS with citation + 3 rules", () => {
    expect(ALL_PACKS.some((p) => p.id === masPack.id)).toBe(true);
    expect(masPack.rules.length).toBe(3);
    expect(masPack.citation).toMatch(/MAS FEAT/);
  });

  it("WARNS on financial decision with unknown modelUsed (no traceability)", async () => {
    const rule = findRule(masRules, "mas-feat-traceability");
    const v = await evalAt(
      rule,
      "Loan approved at standard rate.",
      {},
      { modelUsed: "unknown" },
    );
    expect(v.verdict).toBe("warn");
    expect(v.reason).toMatch(/FEAT/);
  });

  it("PASSES when modelUsed is named", async () => {
    const rule = findRule(masRules, "mas-feat-traceability");
    const v = await evalAt(
      rule,
      "Loan approved at standard rate.",
      {},
      { modelUsed: "loan-underwriter-v3.2" },
    );
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS output containing a Singapore NRIC", async () => {
    const rule = findRule(masRules, "mas-pdpa-no-raw-nric");
    const v = await evalAt(rule, "Customer S1234567D holds account ABC.");
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/NRIC/);
  });

  it("PASSES when no NRIC is present", async () => {
    const rule = findRule(masRules, "mas-pdpa-no-raw-nric");
    const v = await evalAt(rule, "Customer holds account ABC.");
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on financial output missing bias attestation", async () => {
    const rule = findRule(masRules, "mas-feat-bias-attestation");
    const v = await evalAt(
      rule,
      "Insurance premium calculated at SGD 1500/year.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES when bias attestation is present", async () => {
    const rule = findRule(masRules, "mas-feat-bias-attestation");
    const v = await evalAt(
      rule,
      "Insurance premium calculated at SGD 1500/year. Bias check completed against protected-class factors.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("FCA pack — Consumer Duty + AI Guidance", () => {
  it("registers in ALL_PACKS with citation + 3 rules", () => {
    expect(ALL_PACKS.some((p) => p.id === fcaPack.id)).toBe(true);
    expect(fcaPack.rules.length).toBe(3);
    expect(fcaPack.citation).toMatch(/FCA PRIN/);
  });

  it("WARNS on high-pressure language without consumer-outcome justification", async () => {
    const rule = findRule(fcaRules, "fca-consumer-duty-good-outcomes");
    const v = await evalAt(
      rule,
      "Act now! Limited time offer — sign up today only.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-pressure language with justification", async () => {
    const rule = findRule(fcaRules, "fca-consumer-duty-good-outcomes");
    const v = await evalAt(
      rule,
      "Sign up today to lock in the rate because it benefits your long-term consumer outcome.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS when vulnerability signal in input has no adjustment in output", async () => {
    const rule = findRule(fcaRules, "fca-vulnerable-customer-flag");
    const v = await evalAt(rule, "Standard policy issued.", {
      applicantNote: "Recently bereaved customer, partner deceased",
    });
    expect(v.verdict).toBe("warn");
  });

  it("PASSES when adjustment note is present", async () => {
    const rule = findRule(fcaRules, "fca-vulnerable-customer-flag");
    const v = await evalAt(
      rule,
      "Policy issued with enhanced support adjustment.",
      { applicantNote: "Recently bereaved customer" },
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on AI financial decision without explanation anchor", async () => {
    const rule = findRule(fcaRules, "fca-sysc-ai-explainability");
    const v = await evalAt(rule, "Approved.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES financial decision with explanation", async () => {
    const rule = findRule(fcaRules, "fca-sysc-ai-explainability");
    const v = await evalAt(
      rule,
      "Approved because of demonstrated repayment history and stable income.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — all 8 packs", () => {
  it("ALL_PACKS contains 8 packs after Wave 51", () => {
    expect(ALL_PACKS.length).toBe(8);
  });

  it("every pack has a unique id + non-empty rules", () => {
    const ids = new Set<string>();
    for (const p of ALL_PACKS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.rules.length).toBeGreaterThan(0);
      expect(p.citation.length).toBeGreaterThan(5);
    }
  });
});
