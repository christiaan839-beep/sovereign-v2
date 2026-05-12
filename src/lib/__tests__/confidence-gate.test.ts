/**
 * Tests for src/lib/confidence-gate.ts — the abstain-when-unsure policy.
 *
 * The gate exists to prevent the most damaging production failure mode
 * in AI: the authoritative wrong answer. These tests lock the
 * three-state outcome (commit / escalate / abstain) against every
 * relevant policy boundary so a future refactor can't accidentally
 * regress the abstain behaviour.
 *
 * `confidenceGate` itself calls the live AI router, so we mock
 * `confidentAi` from "../consensus" rather than exercising the
 * real models. The pure policy helpers (`resolveThreshold`,
 * `classifyConfidence`) are exercised directly without any mocking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveThreshold,
  classifyConfidence,
  confidenceGate,
  CONFIDENCE_THRESHOLDS,
} from "../confidence-gate";

vi.mock("../consensus", () => ({
  confidentAi: vi.fn(),
}));

import { confidentAi } from "../consensus";

const confidentAiMock = vi.mocked(confidentAi);

beforeEach(() => {
  confidentAiMock.mockReset();
});

describe("resolveThreshold", () => {
  it("returns the standard tier when input is undefined", () => {
    expect(resolveThreshold(undefined)).toBe(CONFIDENCE_THRESHOLDS.standard);
  });

  it("resolves each named tier to its numeric threshold", () => {
    expect(resolveThreshold("permissive")).toBe(
      CONFIDENCE_THRESHOLDS.permissive,
    );
    expect(resolveThreshold("standard")).toBe(CONFIDENCE_THRESHOLDS.standard);
    expect(resolveThreshold("strict")).toBe(CONFIDENCE_THRESHOLDS.strict);
    expect(resolveThreshold("critical")).toBe(CONFIDENCE_THRESHOLDS.critical);
  });

  it("passes a valid numeric threshold through unchanged", () => {
    expect(resolveThreshold(0.42)).toBe(0.42);
    expect(resolveThreshold(0)).toBe(0);
    expect(resolveThreshold(1)).toBe(1);
  });

  it("clamps a numeric threshold > 1 to 1", () => {
    expect(resolveThreshold(1.5)).toBe(1);
    expect(resolveThreshold(99)).toBe(1);
  });

  it("clamps a negative numeric threshold to 0", () => {
    expect(resolveThreshold(-0.5)).toBe(0);
    expect(resolveThreshold(-99)).toBe(0);
  });

  it("ranks the four tiers in strictly increasing order", () => {
    // Locking this so a future "rebalancing" can't accidentally
    // make `critical` more permissive than `standard`.
    expect(CONFIDENCE_THRESHOLDS.permissive).toBeLessThan(
      CONFIDENCE_THRESHOLDS.standard,
    );
    expect(CONFIDENCE_THRESHOLDS.standard).toBeLessThan(
      CONFIDENCE_THRESHOLDS.strict,
    );
    expect(CONFIDENCE_THRESHOLDS.strict).toBeLessThan(
      CONFIDENCE_THRESHOLDS.critical,
    );
  });
});

describe("classifyConfidence", () => {
  it("commits when confidence is exactly at threshold", () => {
    // Boundary: >= is commit, not >. A test that demands 70% should
    // accept a model that reports exactly 70%.
    const out = classifyConfidence(0.7, 0.7, true);
    expect(out.action).toBe("commit");
    expect(out.reason).toBe("");
  });

  it("commits when confidence is above threshold", () => {
    const out = classifyConfidence(0.95, 0.7, true);
    expect(out.action).toBe("commit");
  });

  it("escalates in the borderline zone [0.5, threshold) when allowed", () => {
    const out = classifyConfidence(0.6, 0.7, true);
    expect(out.action).toBe("escalate");
    expect(out.reason).toBe("");
  });

  it("abstains in the borderline zone when escalation is disabled", () => {
    // Same numbers as the previous test, allowEscalation=false. The
    // gate must abstain instead — never silently fall through to commit.
    const out = classifyConfidence(0.6, 0.7, false);
    expect(out.action).toBe("abstain");
    expect(out.reason).toContain("60%");
    expect(out.reason).toContain("70%");
  });

  it("abstains when confidence is below the escalation floor (0.5)", () => {
    const out = classifyConfidence(0.3, 0.7, true);
    expect(out.action).toBe("abstain");
    expect(out.reason).toContain("30%");
    expect(out.reason).toContain("70%");
    expect(out.reason).toContain("human review");
  });

  it("abstains when confidence is zero (signal-missing case)", () => {
    const out = classifyConfidence(0, 0.7, true);
    expect(out.action).toBe("abstain");
  });

  it("commits when threshold is zero (no-op gate)", () => {
    // A pass-through threshold of 0 must commit everything. Useful
    // for ablation studies and debug modes.
    expect(classifyConfidence(0.05, 0, true).action).toBe("commit");
    expect(classifyConfidence(0, 0, true).action).toBe("commit");
  });
});

describe("confidenceGate (integration)", () => {
  it("commits a high-confidence answer without escalating", async () => {
    confidentAiMock.mockResolvedValueOnce({
      answer: "Paris.",
      confidence: 0.92,
      escalated: false,
      method: "fast",
    });

    const result = await confidenceGate("Capital of France?");

    expect(result.action).toBe("commit");
    expect(result.answer).toBe("Paris.");
    expect(result.confidence).toBe(0.92);
    expect(result.escalated).toBe(false);
    expect(result.reason).toBe("");
    expect(result.threshold).toBe(CONFIDENCE_THRESHOLDS.standard);
  });

  it("respects a strict tier for medical use cases", async () => {
    // Model reports 0.8 confidence — borderline zone for higher tiers.
    // Standard (0.7) commits, strict (0.85) escalates, critical (0.95)
    // also escalates (still ≥ 0.5 floor — only abstains below that).
    confidentAiMock.mockResolvedValue({
      answer: "Likely contact dermatitis.",
      confidence: 0.8,
      escalated: false,
      method: "fast",
    });

    const standard = await confidenceGate("Diagnose this rash", {
      threshold: "standard",
    });
    expect(standard.action).toBe("commit");

    const strict = await confidenceGate("Diagnose this rash", {
      threshold: "strict",
    });
    expect(strict.action).toBe("escalate");

    const critical = await confidenceGate("Diagnose this rash", {
      threshold: "critical",
    });
    expect(critical.action).toBe("escalate");
  });

  it("abstains under the critical tier when confidence falls below 0.5", async () => {
    // Critical tier + sub-0.5 confidence = abstain. This is the
    // safety-of-life path: irreversible-cost domains MUST refuse
    // when the model is genuinely unsure.
    confidentAiMock.mockResolvedValueOnce({
      answer: "Possibly dermatitis but I'm not certain.",
      confidence: 0.3,
      escalated: false,
      method: "fast",
    });

    const result = await confidenceGate("Diagnose this rash", {
      threshold: "critical",
    });
    expect(result.action).toBe("abstain");
    expect(result.reason).toContain("human review");
  });

  it("returns the escalated answer when verifiedAi escalation succeeded", async () => {
    // confidentAi already escalated and produced an answer >= threshold —
    // the gate should honor that as a commit (with escalated=true so the
    // caller can mark the receipt accordingly).
    confidentAiMock.mockResolvedValueOnce({
      answer: "Revised: ICD-10 L23.x contact dermatitis.",
      confidence: 0.88,
      escalated: true,
      method: "verified+revised",
    });

    const result = await confidenceGate("Diagnose this rash", {
      threshold: "strict",
    });

    expect(result.action).toBe("commit");
    expect(result.escalated).toBe(true);
    expect(result.answer).toContain("Revised");
  });

  it("abstains on network error by default rather than fabricating", async () => {
    // The single most important contract of the gate: when upstream
    // fails, NEVER make something up.
    confidentAiMock.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    const result = await confidenceGate("Important question");

    expect(result.action).toBe("abstain");
    expect(result.answer).toBe("");
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain("Upstream");
    expect(result.reason).toContain("human review");
  });

  it("propagates network errors when abstainOnNetworkError is false", async () => {
    // Test harnesses and callsites with custom retry layers can opt
    // out — but the default contract above is what production uses.
    confidentAiMock.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    await expect(
      confidenceGate("Important question", { abstainOnNetworkError: false }),
    ).rejects.toThrow("ETIMEDOUT");
  });

  it("abstains rather than escalates when allowEscalation is false", async () => {
    confidentAiMock.mockResolvedValueOnce({
      answer: "Maybe Paris.",
      confidence: 0.6,
      escalated: false,
      method: "fast",
    });

    const result = await confidenceGate("Capital of France?", {
      allowEscalation: false,
    });

    expect(result.action).toBe("abstain");
    expect(result.reason).toContain("60%");
  });

  it("accepts a numeric threshold (not just a tier name)", async () => {
    confidentAiMock.mockResolvedValueOnce({
      answer: "Yes.",
      confidence: 0.55,
      escalated: false,
      method: "fast",
    });

    const result = await confidenceGate("Yes or no?", { threshold: 0.5 });
    expect(result.action).toBe("commit");
    expect(result.threshold).toBe(0.5);
  });

  it("always returns a JSON-serializable result object", async () => {
    // Receipt-friendly contract: every field must round-trip through
    // JSON.stringify without losing fidelity. No Date, no functions,
    // no undefined.
    confidentAiMock.mockResolvedValueOnce({
      answer: "Test",
      confidence: 0.42,
      escalated: false,
      method: "fast",
    });

    const result = await confidenceGate("test");
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(result);
  });
});
