/**
 * Tests for src/lib/guardian-packs.ts — Wave 30.
 *
 * Every pack's rules are pure functions over a GuardianContext, so
 * every test runs hermetically with hand-built inputs.
 */
import { describe, it, expect } from "vitest";
import {
  hipaaPack,
  sr117Pack,
  naicPack,
  dscsaPack,
  csrdPack,
  ALL_PACKS,
  findPack,
  composePacks,
} from "@/lib/guardian-packs";
import type { GuardianContext } from "@/lib/guardian-runner";

function ctx(
  output: unknown,
  partial: Partial<GuardianContext> = {},
): GuardianContext {
  return {
    runId: "run_test",
    agentSlug: "test-agent",
    input: {},
    output,
    ...partial,
  };
}

describe("HIPAA pack", () => {
  it("BLOCKS output containing a raw SSN", async () => {
    const rule = hipaaPack.rules.find((r) => r.id === "hipaa-no-raw-ssn")!;
    const r = await rule.evaluate(ctx("Patient SSN: 123-45-6789"));
    expect(r.verdict).toBe("block");
    expect(r.reason).toMatch(/SSN/);
  });

  it("PASSES clean output", async () => {
    const rule = hipaaPack.rules.find((r) => r.id === "hipaa-no-raw-ssn")!;
    expect((await rule.evaluate(ctx("patient is doing well"))).verdict).toBe(
      "pass",
    );
  });

  it("WARNS on MRN pattern", async () => {
    const rule = hipaaPack.rules.find((r) => r.id === "hipaa-no-mrn")!;
    const r = await rule.evaluate(ctx("see MRN-12345678 for details"));
    expect(r.verdict).toBe("warn");
  });

  it("WARNS on DOB pattern (MM/DD/YYYY)", async () => {
    const rule = hipaaPack.rules.find((r) => r.id === "hipaa-no-dob")!;
    expect((await rule.evaluate(ctx("DOB 03/15/1985"))).verdict).toBe("warn");
  });

  it("WARNS on phone number", async () => {
    const rule = hipaaPack.rules.find((r) => r.id === "hipaa-no-phone")!;
    expect((await rule.evaluate(ctx("call (415) 555-0123"))).verdict).toBe(
      "warn",
    );
  });
});

describe("SR 11-7 pack", () => {
  it("BLOCKS a bare numeric output (no narrative)", async () => {
    const rule = sr117Pack.rules.find(
      (r) => r.id === "sr-11-7-no-bare-numeric-decision",
    )!;
    expect((await rule.evaluate(ctx("0.73"))).verdict).toBe("block");
    expect((await rule.evaluate(ctx("82%"))).verdict).toBe("block");
  });

  it("PASSES narrative output", async () => {
    const rule = sr117Pack.rules.find(
      (r) => r.id === "sr-11-7-no-bare-numeric-decision",
    )!;
    expect((await rule.evaluate(ctx("PD = 0.73; driven by ..."))).verdict).toBe(
      "pass",
    );
  });

  it("WARNS on rationale under 200 chars", async () => {
    const rule = sr117Pack.rules.find(
      (r) => r.id === "sr-11-7-warns-on-short-narrative",
    )!;
    expect((await rule.evaluate(ctx("Too short rationale."))).verdict).toBe(
      "warn",
    );
    expect((await rule.evaluate(ctx("X".repeat(250)))).verdict).toBe("pass");
  });
});

describe("NAIC AI Bulletin pack", () => {
  it("WARNS when output references a protected class", async () => {
    const rule = naicPack.rules.find(
      (r) => r.id === "naic-no-protected-class-disparity",
    )!;
    const r = await rule.evaluate(
      ctx("Decision adjusted for applicant's gender and marital status."),
    );
    expect(r.verdict).toBe("warn");
    expect(r.evidence?.class).toBeDefined();
  });

  it("PASSES neutral decision narratives", async () => {
    const rule = naicPack.rules.find(
      (r) => r.id === "naic-no-protected-class-disparity",
    )!;
    expect(
      (await rule.evaluate(ctx("Premium calculated from claim history.")))
        .verdict,
    ).toBe("pass");
  });

  it("WARNS when decision doesn't cite the model", async () => {
    const rule = naicPack.rules.find(
      (r) => r.id === "naic-decision-cites-model",
    )!;
    const r = await rule.evaluate(ctx("Approved at $850/year."));
    expect(r.verdict).toBe("warn");
  });

  it("PASSES when ctx.tokenId is present (Wave-16 JIT token IS the model citation)", async () => {
    const rule = naicPack.rules.find(
      (r) => r.id === "naic-decision-cites-model",
    )!;
    const r = await rule.evaluate(
      ctx("Approved at $850/year.", { tokenId: "tok_1234" }),
    );
    expect(r.verdict).toBe("pass");
  });

  it("PASSES when narrative cites the model explicitly", async () => {
    const rule = naicPack.rules.find(
      (r) => r.id === "naic-decision-cites-model",
    )!;
    expect(
      (
        await rule.evaluate(
          ctx("Approved. Used model: underwriter-v3.2 for the decision."),
        )
      ).verdict,
    ).toBe("pass");
  });
});

describe("DSCSA pack", () => {
  it("BLOCKS trace narrative missing NDC code", async () => {
    const rule = dscsaPack.rules.find(
      (r) => r.id === "dscsa-trace-narrative-cites-ndc",
    )!;
    const r = await rule.evaluate(
      ctx("Drug trace from manufacturer to wholesaler completed."),
    );
    expect(r.verdict).toBe("block");
  });

  it("PASSES trace narrative with NDC", async () => {
    const rule = dscsaPack.rules.find(
      (r) => r.id === "dscsa-trace-narrative-cites-ndc",
    )!;
    expect(
      (
        await rule.evaluate(
          ctx("Drug trace completed for NDC 12345-678-90 lot A1."),
        )
      ).verdict,
    ).toBe("pass");
  });

  it("BLOCKS recall narrative missing lot/serial citation", async () => {
    const rule = dscsaPack.rules.find(
      (r) => r.id === "dscsa-recall-cites-lot",
    )!;
    expect(
      (await rule.evaluate(ctx("Class-I recall initiated for product XYZ.")))
        .verdict,
    ).toBe("block");
  });

  it("PASSES recall narrative with lot citation", async () => {
    const rule = dscsaPack.rules.find(
      (r) => r.id === "dscsa-recall-cites-lot",
    )!;
    expect(
      (
        await rule.evaluate(
          ctx("Class-I recall initiated for product XYZ, lot: A1B2C3."),
        )
      ).verdict,
    ).toBe("pass");
  });
});

describe("CSRD / ESRS pack", () => {
  it("WARNS when an ESRS datapoint claim has no source citation", async () => {
    const rule = csrdPack.rules.find((r) => r.id === "csrd-cites-data-source")!;
    const r = await rule.evaluate(
      ctx("ESRS E1-6 disclosure: scope 1 emissions = 14,000 tCO2e."),
    );
    expect(r.verdict).toBe("warn");
  });

  it("PASSES when datapoint cites a source", async () => {
    const rule = csrdPack.rules.find((r) => r.id === "csrd-cites-data-source")!;
    const r = await rule.evaluate(
      ctx(
        "ESRS E1-6: scope 1 emissions = 14,000 tCO2e (source: 2025 audited GHG inventory).",
      ),
    );
    expect(r.verdict).toBe("pass");
  });

  it("WARNS when materiality narrative skips one perspective", async () => {
    const rule = csrdPack.rules.find(
      (r) => r.id === "csrd-double-materiality-flag",
    )!;
    const r = await rule.evaluate(
      ctx("Climate change presents financial materiality for our operations."),
    );
    expect(r.verdict).toBe("warn");
    expect(r.evidence?.hasFinancial).toBe(true);
    expect(r.evidence?.hasImpact).toBe(false);
  });

  it("PASSES when materiality narrative covers BOTH perspectives", async () => {
    const rule = csrdPack.rules.find(
      (r) => r.id === "csrd-double-materiality-flag",
    )!;
    const r = await rule.evaluate(
      ctx(
        "We assessed both financial materiality (impact on enterprise value) and impact materiality (impact on people/planet).",
      ),
    );
    expect(r.verdict).toBe("pass");
  });
});

describe("Pack registry", () => {
  it("ALL_PACKS has at least the 5 we shipped", () => {
    expect(ALL_PACKS.length).toBeGreaterThanOrEqual(5);
  });

  it("every pack has a stable id, name, citation, and at least one rule", () => {
    for (const p of ALL_PACKS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.citation.length).toBeGreaterThan(0);
      expect(p.rules.length).toBeGreaterThan(0);
    }
  });

  it("findPack returns the pack by id", () => {
    expect(findPack("hipaa-2026")?.name).toMatch(/HIPAA/);
  });

  it("findPack returns undefined for unknown ids", () => {
    expect(findPack("nope")).toBeUndefined();
  });
});

describe("composePacks", () => {
  it("combines rule lists in declaration order", () => {
    const composed = composePacks(hipaaPack, naicPack);
    expect(composed.length).toBeGreaterThan(0);
    // First rule should come from HIPAA (declared first).
    expect(composed[0]!.id.startsWith("hipaa-")).toBe(true);
  });

  it("deduplicates rules across overlapping packs", () => {
    // hipaaPack twice — second copy's rules should be deduped by id.
    const composed = composePacks(hipaaPack, hipaaPack);
    expect(composed.length).toBe(hipaaPack.rules.length);
  });
});
