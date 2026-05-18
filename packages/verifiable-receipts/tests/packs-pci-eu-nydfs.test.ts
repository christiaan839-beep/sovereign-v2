/**
 * Guardian rule packs — PCI DSS / EU AI Act / NYDFS Part 500.
 *
 * Each rule tested positive AND negative. Tests double as
 * documentation for the regulatory clauses cited inline.
 */
import { describe, it, expect } from "vitest";
import {
  pciDssRules,
  pciDssPack,
  euAiActRules,
  euAiActPack,
  nydfsRules,
  nydfsPack,
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

describe("PCI DSS pack — v4.0", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === pciDssPack.id)).toBe(true);
    expect(pciDssPack.rules.length).toBe(3);
    expect(pciDssPack.citation).toMatch(/Payment Card/i);
  });

  it("BLOCKS output containing a full Visa PAN", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-full-pan");
    const v = await evalAt(rule, "Card on file: 4111111111111111");
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/PCI DSS/);
  });

  it("BLOCKS output containing a full Mastercard PAN", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-full-pan");
    const v = await evalAt(rule, "Charge applied to 5555555555554444");
    expect(v.verdict).toBe("block");
  });

  it("BLOCKS output containing a full Amex PAN (15 digits)", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-full-pan");
    const v = await evalAt(rule, "Receipt for card 378282246310005");
    expect(v.verdict).toBe("block");
  });

  it("PASSES output with a properly-masked PAN", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-full-pan");
    const v = await evalAt(rule, "Card on file: 411111******1111");
    expect(v.verdict).toBe("pass");
  });

  it("BLOCKS output containing a CVV reference", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-cvv");
    const v = await evalAt(rule, "Use CVV: 123 for auth.");
    expect(v.verdict).toBe("block");
  });

  it("BLOCKS output containing magnetic-stripe track data", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-track-data");
    const v = await evalAt(rule, "Track: ;4111111111111111=2512123?");
    expect(v.verdict).toBe("block");
  });

  it("PASSES output with no card data", async () => {
    const rule = findRule(pciDssRules, "pci-dss-no-full-pan");
    const v = await evalAt(rule, "Payment processed successfully.");
    expect(v.verdict).toBe("pass");
  });
});

describe("EU AI Act pack — high-risk system obligations", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === euAiActPack.id)).toBe(true);
    expect(euAiActPack.rules.length).toBe(3);
    expect(euAiActPack.citation).toMatch(/EU\) 2024\/1689/);
  });

  it("BLOCKS credit-scoring output without AI-disclosure", async () => {
    const rule = findRule(euAiActRules, "eu-ai-act-art13-ai-disclosure");
    const v = await evalAt(
      rule,
      "Credit score: 720. Recommended action: approve.",
    );
    expect(v.verdict).toBe("block");
    expect(v.reason).toMatch(/AI Act/);
  });

  it("PASSES credit-scoring output WITH AI-disclosure", async () => {
    const rule = findRule(euAiActRules, "eu-ai-act-art13-ai-disclosure");
    const v = await evalAt(
      rule,
      "Credit score: 720 (AI-generated). Recommended action: approve.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("PASSES non-high-risk output without AI-disclosure", async () => {
    const rule = findRule(euAiActRules, "eu-ai-act-art13-ai-disclosure");
    const v = await evalAt(rule, "Marketing email draft below.");
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on hiring output without human-oversight pathway", async () => {
    const rule = findRule(
      euAiActRules,
      "eu-ai-act-art14-human-oversight-handoff",
    );
    const v = await evalAt(
      rule,
      "Applicant recommended for hire by AI-generated screening.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES hiring output WITH human-review pathway mentioned", async () => {
    const rule = findRule(
      euAiActRules,
      "eu-ai-act-art14-human-oversight-handoff",
    );
    const v = await evalAt(
      rule,
      "AI-generated screening: applicant recommended. Subject to human review and appeal.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on high-risk output missing accuracy metric", async () => {
    const rule = findRule(euAiActRules, "eu-ai-act-art15-accuracy-attestation");
    const v = await evalAt(rule, "AI-generated recidivism prediction: high.");
    expect(v.verdict).toBe("warn");
  });

  it("PASSES high-risk output WITH confidence metric", async () => {
    const rule = findRule(euAiActRules, "eu-ai-act-art15-accuracy-attestation");
    const v = await evalAt(
      rule,
      "AI-generated recidivism prediction: high (confidence: 0.87).",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("NYDFS Part 500 pack — Cybersecurity + AI Letter", () => {
  it("registers in ALL_PACKS with 3 rules + correct citation", () => {
    expect(ALL_PACKS.some((p) => p.id === nydfsPack.id)).toBe(true);
    expect(nydfsPack.rules.length).toBe(3);
    expect(nydfsPack.citation).toMatch(/NYCRR Part 500/);
  });

  it("WARNS on authentication output without MFA reference", async () => {
    const rule = findRule(nydfsRules, "nydfs-500-multi-factor-recommendation");
    const v = await evalAt(
      rule,
      "Login with username and password to access the system.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES authentication output WITH MFA reference", async () => {
    const rule = findRule(nydfsRules, "nydfs-500-multi-factor-recommendation");
    const v = await evalAt(
      rule,
      "Login with username, password, and MFA token to access the system.",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on third-party integration without attestation", async () => {
    const rule = findRule(
      nydfsRules,
      "nydfs-ai-letter-third-party-attestation",
    );
    const v = await evalAt(
      rule,
      "Integrating with a third-party data vendor for risk scoring.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES third-party integration WITH attestation note", async () => {
    const rule = findRule(
      nydfsRules,
      "nydfs-ai-letter-third-party-attestation",
    );
    const v = await evalAt(
      rule,
      "Integrating with a third-party data vendor (attested via SOC 2 Type II report).",
    );
    expect(v.verdict).toBe("pass");
  });

  it("WARNS on incident-related output missing 72h filing reminder", async () => {
    const rule = findRule(nydfsRules, "nydfs-500-incident-trigger-language");
    const v = await evalAt(
      rule,
      "Possible unauthorized access detected on customer database.",
    );
    expect(v.verdict).toBe("warn");
  });

  it("PASSES incident output WITH 72h filing reminder", async () => {
    const rule = findRule(nydfsRules, "nydfs-500-incident-trigger-language");
    const v = await evalAt(
      rule,
      "Possible unauthorized access detected. Reportable per NYDFS Part 500 — file with the superintendent within 72 hours.",
    );
    expect(v.verdict).toBe("pass");
  });
});

describe("Composition — all 11 packs", () => {
  it("ALL_PACKS contains 11 packs after Wave 52", () => {
    expect(ALL_PACKS.length).toBe(11);
  });

  it("every pack has unique id + non-empty rules + citation", () => {
    const ids = new Set<string>();
    for (const p of ALL_PACKS) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.rules.length).toBeGreaterThan(0);
      expect(p.citation.length).toBeGreaterThan(5);
    }
  });
});
