/**
 * Tests for src/lib/guardian-runner.ts — Wave 17 Guardian SDK.
 *
 * The Guardian runner is a pure orchestrator over user-supplied rules.
 * No DB, no network — tests run with the same signing scheme the
 * receipt path uses (HMAC v1 when AGENT_RUN_SIGNING_SECRET is set).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import {
  runGuardian,
  verifyGuardianAttestation,
  quorumCollapse,
  outputSizeRule,
  forbiddenSubstringRule,
  requireTokenRule,
  type GuardianContext,
  type GuardianRule,
} from "@/lib/guardian-runner";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeAll(() => {
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});
afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

const CTX: GuardianContext = {
  runId: "run_test_01",
  agentSlug: "test-agent",
  tokenId: "tok_test_01",
  input: { question: "hi" },
  output: { answer: "hello" },
};

const passRule: GuardianRule = {
  id: "always-pass",
  description: "pass",
  evaluate: async () => ({ verdict: "pass" }),
};
const warnRule: GuardianRule = {
  id: "always-warn",
  description: "warn",
  evaluate: async () => ({ verdict: "warn", reason: "noted" }),
};
const blockRule: GuardianRule = {
  id: "always-block",
  description: "block",
  evaluate: async () => ({ verdict: "block", reason: "deny" }),
};
const throwRule: GuardianRule = {
  id: "throws",
  description: "throws",
  evaluate: async () => {
    throw new Error("rule-crash");
  },
};

describe("runGuardian — collapsing verdicts", () => {
  it("returns pass when every rule passes", async () => {
    const a = await runGuardian([passRule, passRule], CTX);
    expect(a.overall).toBe("pass");
    expect(a.rules).toHaveLength(2);
  });

  it("returns warn when at least one rule warns and none block", async () => {
    const a = await runGuardian([passRule, warnRule], CTX);
    expect(a.overall).toBe("warn");
  });

  it("returns block when any rule blocks (block beats warn)", async () => {
    const a = await runGuardian([passRule, warnRule, blockRule], CTX);
    expect(a.overall).toBe("block");
  });

  it("converts a thrown rule into a warn verdict carrying the error message", async () => {
    const a = await runGuardian([passRule, throwRule], CTX);
    expect(a.overall).toBe("warn");
    const t = a.rules.find((r) => r.ruleId === "throws");
    expect(t?.verdict).toBe("warn");
    expect(t?.reason).toBe("rule-crash");
  });

  it("includes per-rule durationMs measurements", async () => {
    const a = await runGuardian([passRule], CTX);
    expect(a.rules[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(a.totalMs).toBeGreaterThanOrEqual(0);
  });
});

describe("runGuardian — attestation envelope", () => {
  it("produces a verdictId, contentHash, signature, and canonical projection", async () => {
    const a = await runGuardian([passRule], CTX);
    expect(a.verdictId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.signature).toMatch(/^v1=[0-9a-f]+$/);
    expect(a.canonical).toMatch(/"type":"guardian-verdict"/);
  });

  it("binds runId, agentSlug, tokenId into the canonical projection", async () => {
    const a = await runGuardian([passRule], CTX);
    const parsed = JSON.parse(a.canonical) as Record<string, unknown>;
    expect(parsed.runId).toBe(CTX.runId);
    expect(parsed.agentSlug).toBe(CTX.agentSlug);
    expect(parsed.tokenId).toBe(CTX.tokenId);
  });

  it("sorts rules in the canonical so verdict order doesn't affect the hash", async () => {
    const a = await runGuardian([blockRule, warnRule, passRule], CTX);
    const b = await runGuardian([passRule, warnRule, blockRule], CTX);
    // verdictId differs (random) so canonicals differ, but the rule
    // ORDER inside each canonical is the same (lex-sorted by ruleId).
    const aRules = JSON.parse(a.canonical).rules as Array<{ ruleId: string }>;
    const bRules = JSON.parse(b.canonical).rules as Array<{ ruleId: string }>;
    expect(aRules.map((r) => r.ruleId)).toEqual([
      "always-block",
      "always-pass",
      "always-warn",
    ]);
    expect(bRules.map((r) => r.ruleId)).toEqual(aRules.map((r) => r.ruleId));
  });
});

describe("verifyGuardianAttestation", () => {
  it("returns ok=true on an unmutated envelope", async () => {
    const a = await runGuardian([passRule], CTX);
    expect(verifyGuardianAttestation(a)).toEqual({ ok: true });
  });

  it("returns hash-mismatch when contentHash is tampered", async () => {
    const a = await runGuardian([passRule], CTX);
    const tampered = { ...a, contentHash: "0".repeat(64) };
    const r = verifyGuardianAttestation(tampered);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("hash-mismatch");
  });

  it("returns signature-mismatch when signature bytes are tampered", async () => {
    const a = await runGuardian([passRule], CTX);
    const tampered = { ...a, signature: "v1=" + "0".repeat(64) };
    const r = verifyGuardianAttestation(tampered);
    expect(r.ok).toBe(false);
    expect(["signature-mismatch", "hash-mismatch"]).toContain(r.reason);
  });
});

describe("quorumCollapse", () => {
  it("returns block when any verdict is block", () => {
    expect(quorumCollapse(["pass", "warn", "block"], 1)).toBe("block");
  });
  it("returns warn when warn count >= required", () => {
    expect(quorumCollapse(["pass", "warn", "warn"], 2)).toBe("warn");
  });
  it("returns pass otherwise", () => {
    expect(quorumCollapse(["pass", "pass"], 1)).toBe("pass");
  });
});

describe("built-in rules", () => {
  it("outputSizeRule blocks oversized outputs", async () => {
    const big = "x".repeat(5000);
    const r = await outputSizeRule(1000).evaluate({ ...CTX, output: big });
    expect(r.verdict).toBe("block");
  });

  it("outputSizeRule passes small outputs", async () => {
    const r = await outputSizeRule(10_000).evaluate(CTX);
    expect(r.verdict).toBe("pass");
  });

  it("forbiddenSubstringRule warns when the output contains a forbidden term", async () => {
    const r = await forbiddenSubstringRule(["secret"]).evaluate({
      ...CTX,
      output: { msg: "the SECRET sauce" },
    });
    expect(r.verdict).toBe("warn");
    expect(r.evidence?.hits).toEqual(["secret"]);
  });

  it("requireTokenRule blocks when no tokenId is present", async () => {
    const r = await requireTokenRule.evaluate({ ...CTX, tokenId: undefined });
    expect(r.verdict).toBe("block");
  });

  it("requireTokenRule passes when a tokenId is present", async () => {
    const r = await requireTokenRule.evaluate(CTX);
    expect(r.verdict).toBe("pass");
  });
});
