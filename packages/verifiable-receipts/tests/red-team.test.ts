/**
 * Adversarial red-team tests.
 *
 * Each test proves that a specific Guardian rule successfully blocks
 * (or warns on) the adversarial input we hand it. These tests double
 * as the **public proof corpus** procurement teams can run themselves
 * via `npm test` to verify our coverage claims.
 */
import { describe, it, expect } from "vitest";
import {
  runRedTeam,
  defaultAdversarialCorpus,
  type AttackClass,
} from "../src/red-team.js";
import { ALL_PACKS, composePacks, hipaaPack } from "../src/packs.js";

describe("Red-team module — corpus shape", () => {
  it("exposes a non-empty default corpus", () => {
    const corpus = defaultAdversarialCorpus();
    expect(corpus.length).toBeGreaterThan(10);
  });

  it("every corpus entry has all required fields", () => {
    const corpus = defaultAdversarialCorpus();
    for (const entry of corpus) {
      expect(typeof entry.description).toBe("string");
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.output).toBeDefined();
      expect(typeof entry.attackClass).toBe("string");
      expect(Array.isArray(entry.expectedRuleIds)).toBe(true);
      expect(entry.expectedRuleIds.length).toBeGreaterThan(0);
    }
  });

  it("every corpus entry's expectedRuleIds reference real rules in ALL_PACKS", () => {
    const knownRuleIds = new Set<string>();
    for (const pack of ALL_PACKS) {
      for (const r of pack.rules) knownRuleIds.add(r.id);
    }
    const corpus = defaultAdversarialCorpus();
    for (const entry of corpus) {
      for (const ruleId of entry.expectedRuleIds) {
        expect(knownRuleIds.has(ruleId)).toBe(true);
      }
    }
  });

  it("covers ≥ 8 distinct attack classes", () => {
    const corpus = defaultAdversarialCorpus();
    const classes = new Set<AttackClass>();
    for (const entry of corpus) classes.add(entry.attackClass);
    expect(classes.size).toBeGreaterThanOrEqual(8);
  });
});

describe("Red-team module — runRedTeam against ALL_PACKS", () => {
  it("returns a structured report with required fields", async () => {
    const rules = ALL_PACKS.flatMap((p) => p.rules);
    const report = await runRedTeam(rules);

    expect(report.redTeamRunId).toMatch(/^rt_/);
    expect(report.ranAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
    expect(typeof report.rulesTested).toBe("number");
    expect(typeof report.totalAttacks).toBe("number");
    expect(typeof report.overallAttackSuccessRate).toBe("number");
    expect(report.overallAttackSuccessRate).toBeGreaterThanOrEqual(0);
    expect(report.overallAttackSuccessRate).toBeLessThanOrEqual(1);
    expect(Array.isArray(report.ruleResults)).toBe(true);
    expect(typeof report.byAttackClass).toBe("object");
  });

  it("achieves ≥ 90% block-rate across the corpus (defender wins)", async () => {
    const rules = ALL_PACKS.flatMap((p) => p.rules);
    const report = await runRedTeam(rules);
    // Defender wins when attack success rate is LOW.
    expect(report.overallAttackSuccessRate).toBeLessThanOrEqual(0.1);
  });

  it("byAttackClass aggregates run counts + coverage", async () => {
    const rules = ALL_PACKS.flatMap((p) => p.rules);
    const report = await runRedTeam(rules);
    for (const [cls, stat] of Object.entries(report.byAttackClass)) {
      expect(typeof cls).toBe("string");
      expect(stat.run).toBeGreaterThan(0);
      expect(stat.coverage).toBeGreaterThanOrEqual(0);
      expect(stat.coverage).toBeLessThanOrEqual(1);
    }
  });

  it("ruleResults sort high-ASR-first so reviewers see weakest rules first", async () => {
    const rules = ALL_PACKS.flatMap((p) => p.rules);
    const report = await runRedTeam(rules);
    for (let i = 1; i < report.ruleResults.length; i++) {
      expect(
        report.ruleResults[i - 1].attackSuccessRate,
      ).toBeGreaterThanOrEqual(report.ruleResults[i].attackSuccessRate);
    }
  });
});

describe("Red-team module — narrow pack coverage", () => {
  it("HIPAA-only run only reports HIPAA rule results", async () => {
    const report = await runRedTeam(hipaaPack.rules);
    // Every rule in the report must be a HIPAA rule.
    const hipaaIds = new Set(hipaaPack.rules.map((r) => r.id));
    for (const result of report.ruleResults) {
      expect(hipaaIds.has(result.ruleId)).toBe(true);
    }
  });

  it("composePacks input still runs without dedup error", async () => {
    const rules = composePacks(hipaaPack, hipaaPack); // intentional dup
    const report = await runRedTeam(rules);
    expect(report.rulesTested).toBeGreaterThan(0);
  });

  it("empty rule set returns a valid empty report", async () => {
    const report = await runRedTeam([]);
    expect(report.rulesTested).toBe(0);
    expect(report.totalAttacks).toBe(0);
    expect(report.overallAttackSuccessRate).toBe(0);
    expect(report.ruleResults).toEqual([]);
  });
});

describe("Red-team module — custom adversarial input", () => {
  it("accepts a caller-supplied corpus", async () => {
    const rules = hipaaPack.rules;
    const customCorpus = [
      {
        description: "Caller-supplied SSN attack",
        output: "Patient X has SSN 555-12-3456 in chart.",
        attackClass: "pii-extraction" as const,
        expectedRuleIds: ["hipaa-no-raw-ssn"],
      },
    ];
    const report = await runRedTeam(rules, customCorpus);
    expect(report.totalAttacks).toBe(1);
    // SSN regex MUST catch this.
    expect(report.totalMissed).toBe(0);
  });
});
