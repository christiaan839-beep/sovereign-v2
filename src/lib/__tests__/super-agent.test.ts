/**
 * Tests for src/lib/super-agent.ts — the elite-stack composition.
 *
 * The super-agent helper composes confidence-gate (Cook 32) and
 * expert-critic (Cook 32) into a single call so every Cook-33+
 * entry-level agent inherits the full reliability stack by default.
 *
 * These tests lock the three-outcome contract (commit / revise /
 * abstain), the gate→critic ordering, the rubricId=null skip path,
 * and the response-envelope serialization. The two underlying
 * primitives are mocked so this suite tests COMPOSITION, not the
 * primitives themselves (which have their own dedicated suites).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../confidence-gate", () => ({
  confidenceGate: vi.fn(),
}));
vi.mock("../expert-critic", () => ({
  expertReview: vi.fn(),
}));

import { confidenceGate } from "../confidence-gate";
import { expertReview } from "../expert-critic";
import {
  runSuperAgent,
  isShippable,
  toResponseEnvelope,
  type SuperAgentSpec,
  type SuperAgentResult,
} from "../super-agent";

const gateMock = vi.mocked(confidenceGate);
const criticMock = vi.mocked(expertReview);

const STD_SPEC: SuperAgentSpec = {
  agentSlug: "test-agent",
  systemPrompt: "You are a test agent.",
  confidenceTier: "standard",
  rubricId: "generic-audit-ready",
};

beforeEach(() => {
  gateMock.mockReset();
  criticMock.mockReset();
});

describe("runSuperAgent — outcome routing", () => {
  it("commits when the gate clears AND the critic passes", async () => {
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "Paris.",
      confidence: 0.92,
      threshold: 0.7,
      escalated: false,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: true,
      worstSeverity: null,
      findings: [],
      revisionPrompt: "",
      rubricId: "generic-audit-ready",
    });

    const result = await runSuperAgent("Capital of France?", STD_SPEC);

    expect(result.outcome).toBe("commit");
    if (result.outcome === "commit") {
      expect(result.answer).toBe("Paris.");
      expect(result.confidence).toBe(0.92);
      expect(result.escalated).toBe(false);
      expect(result.critic?.pass).toBe(true);
    }
  });

  it("aborts at the gate without invoking the critic when the gate abstains", async () => {
    // Critical contract: when the gate abstains, the critic is never
    // called. Wastes a model call AND lets a failed-gate output sneak
    // into the critic input.
    gateMock.mockResolvedValueOnce({
      action: "abstain",
      answer: "I'm not sure.",
      confidence: 0.3,
      threshold: 0.7,
      escalated: false,
      reason: "Below threshold; routing to human review.",
    });

    const result = await runSuperAgent("Hard question?", STD_SPEC);

    expect(result.outcome).toBe("abstain");
    if (result.outcome === "abstain") {
      expect(result.draft).toBe("I'm not sure.");
      expect(result.confidence).toBe(0.3);
      expect(result.reason).toContain("human review");
    }
    expect(criticMock).not.toHaveBeenCalled();
  });

  it("returns revise when the critic flags must-pass failures", async () => {
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "Some answer without a citation.",
      confidence: 0.85,
      threshold: 0.7,
      escalated: false,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: false,
      worstSeverity: "major",
      findings: [
        {
          severity: "major",
          category: "missing-citation",
          detail: "Claim 'X' lacks a citable source.",
          suggestion: "Add the source URL.",
        },
      ],
      revisionPrompt: "Add a citation for the X claim.",
      rubricId: "generic-audit-ready",
    });

    const result = await runSuperAgent("Question?", STD_SPEC);

    expect(result.outcome).toBe("revise");
    if (result.outcome === "revise") {
      expect(result.candidate).toContain("without a citation");
      expect(result.critic.pass).toBe(false);
      expect(result.revisionPrompt).toContain("citation");
    }
  });

  it("falls back to a synthesized revisionPrompt if the critic returns an empty one", async () => {
    // The critic SHOULD always provide a revisionPrompt when pass=false,
    // but the gate-keeping contract says we can't rely on that — we
    // synthesize from the findings if it's missing.
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "candidate",
      confidence: 0.85,
      threshold: 0.7,
      escalated: false,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: false,
      worstSeverity: "major",
      findings: [
        {
          severity: "major",
          category: "x",
          detail: "Issue A",
          suggestion: "Fix A",
        },
        {
          severity: "minor",
          category: "y",
          detail: "Issue B",
          suggestion: "Fix B",
        },
      ],
      revisionPrompt: "", // empty — critic forgot to fill it
      rubricId: "generic-audit-ready",
    });

    const result = await runSuperAgent("Question?", STD_SPEC);

    expect(result.outcome).toBe("revise");
    if (result.outcome === "revise") {
      expect(result.revisionPrompt).toContain("Issue A");
      expect(result.revisionPrompt).toContain("Issue B");
    }
  });

  it("preserves the escalated flag from the gate on a commit", async () => {
    // Receipt-relevant: a downstream replay needs to know whether the
    // committed answer came from fast-path or escalated consensus.
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "Revised answer.",
      confidence: 0.9,
      threshold: 0.85,
      escalated: true,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: true,
      worstSeverity: null,
      findings: [],
      revisionPrompt: "",
      rubricId: "generic-audit-ready",
    });

    const result = await runSuperAgent("Hard one?", {
      ...STD_SPEC,
      confidenceTier: "strict",
    });

    expect(result.outcome).toBe("commit");
    if (result.outcome === "commit") {
      expect(result.escalated).toBe(true);
    }
  });
});

describe("runSuperAgent — rubricId=null skip path", () => {
  it("skips the critic entirely when rubricId is null", async () => {
    // Internal/system agents that don't need domain review can opt
    // out of the critic. The gate still runs.
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "Direct commit.",
      confidence: 0.9,
      threshold: 0.7,
      escalated: false,
      reason: "",
    });

    const result = await runSuperAgent("test", {
      ...STD_SPEC,
      rubricId: null,
    });

    expect(result.outcome).toBe("commit");
    if (result.outcome === "commit") {
      expect(result.answer).toBe("Direct commit.");
      expect(result.critic).toBeNull();
    }
    expect(criticMock).not.toHaveBeenCalled();
  });

  it("still abstains correctly when rubricId is null", async () => {
    gateMock.mockResolvedValueOnce({
      action: "abstain",
      answer: "",
      confidence: 0,
      threshold: 0.7,
      escalated: false,
      reason: "Upstream model unavailable.",
    });

    const result = await runSuperAgent("test", {
      ...STD_SPEC,
      rubricId: null,
    });

    expect(result.outcome).toBe("abstain");
    expect(criticMock).not.toHaveBeenCalled();
  });
});

describe("runSuperAgent — option propagation", () => {
  it("forwards the systemPrompt + confidenceTier + maxTokens to the gate", async () => {
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "ok",
      confidence: 0.9,
      threshold: 0.85,
      escalated: false,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: true,
      worstSeverity: null,
      findings: [],
      revisionPrompt: "",
      rubricId: "generic-audit-ready",
    });

    await runSuperAgent("test", {
      agentSlug: "x",
      systemPrompt: "PROMPT",
      confidenceTier: "strict",
      rubricId: "generic-audit-ready",
      maxTokens: 1234,
    });

    expect(gateMock).toHaveBeenCalledWith("test", {
      system: "PROMPT",
      threshold: "strict",
      maxTokens: 1234,
      abstainOnNetworkError: true,
    });
  });

  it("forwards the rubricId to the critic", async () => {
    gateMock.mockResolvedValueOnce({
      action: "commit",
      answer: "candidate",
      confidence: 0.9,
      threshold: 0.7,
      escalated: false,
      reason: "",
    });
    criticMock.mockResolvedValueOnce({
      pass: true,
      worstSeverity: null,
      findings: [],
      revisionPrompt: "",
      rubricId: "pharma-protocol-deviation",
    });

    await runSuperAgent("test", {
      ...STD_SPEC,
      rubricId: "pharma-protocol-deviation",
    });

    expect(criticMock).toHaveBeenCalledWith(
      "candidate",
      "pharma-protocol-deviation",
    );
  });
});

describe("isShippable", () => {
  it("returns true only for commit outcomes", () => {
    const commit: SuperAgentResult = {
      outcome: "commit",
      answer: "x",
      confidence: 0.9,
      escalated: false,
      critic: null,
    };
    const revise: SuperAgentResult = {
      outcome: "revise",
      candidate: "x",
      critic: {
        pass: false,
        worstSeverity: "major",
        findings: [],
        revisionPrompt: "",
        rubricId: "generic-audit-ready",
      },
      revisionPrompt: "fix",
    };
    const abstain: SuperAgentResult = {
      outcome: "abstain",
      draft: "x",
      reason: "y",
      confidence: 0,
    };

    expect(isShippable(commit)).toBe(true);
    expect(isShippable(revise)).toBe(false);
    expect(isShippable(abstain)).toBe(false);
  });
});

describe("toResponseEnvelope", () => {
  it("commit → ok:true with answer + critic summary", () => {
    const env = toResponseEnvelope({
      outcome: "commit",
      answer: "Paris.",
      confidence: 0.92,
      escalated: true,
      critic: {
        pass: true,
        worstSeverity: null,
        findings: [],
        revisionPrompt: "",
        rubricId: "generic-audit-ready",
      },
    });
    expect(env.ok).toBe(true);
    expect(env.answer).toBe("Paris.");
    expect(env.confidence).toBe(0.92);
    expect(env.escalated).toBe(true);
    expect(env.critic).toMatchObject({
      pass: true,
      rubricId: "generic-audit-ready",
    });
  });

  it("commit with critic=null → critic field is null in the envelope", () => {
    const env = toResponseEnvelope({
      outcome: "commit",
      answer: "ok",
      confidence: 0.9,
      escalated: false,
      critic: null,
    });
    expect(env.critic).toBeNull();
  });

  it("revise → ok:false with code + critique block", () => {
    const env = toResponseEnvelope({
      outcome: "revise",
      candidate: "draft",
      critic: {
        pass: false,
        worstSeverity: "blocker",
        findings: [
          {
            severity: "blocker",
            category: "x",
            detail: "y",
            suggestion: "z",
          },
        ],
        revisionPrompt: "fix",
        rubricId: "generic-audit-ready",
      },
      revisionPrompt: "fix",
    });
    expect(env.ok).toBe(false);
    expect(env.code).toBe("REVISE_REQUIRED");
    expect(env.critique).toMatchObject({
      worstSeverity: "blocker",
      revisionPrompt: "fix",
      rubricId: "generic-audit-ready",
    });
  });

  it("abstain → ok:false with code:HUMAN_REVIEW_REQUIRED and no candidate leak", () => {
    // Critical contract: the abstain envelope must NOT include the
    // model's draft. The whole point of abstaining is to hide the
    // unsure attempt from end users.
    const env = toResponseEnvelope({
      outcome: "abstain",
      draft: "this should not appear in the response",
      reason: "Below threshold.",
      confidence: 0.3,
    });
    expect(env.ok).toBe(false);
    expect(env.code).toBe("HUMAN_REVIEW_REQUIRED");
    expect(env.reason).toBe("Below threshold.");
    expect(env.confidence).toBe(0.3);
    // The draft must NOT leak into the user-facing envelope.
    expect(JSON.stringify(env)).not.toContain("this should not appear");
  });

  it("envelope is always JSON-serializable (round-trip)", () => {
    // Receipt contract: every envelope must round-trip through
    // JSON.stringify without losing fidelity.
    const cases: SuperAgentResult[] = [
      {
        outcome: "commit",
        answer: "x",
        confidence: 0.9,
        escalated: false,
        critic: null,
      },
      {
        outcome: "revise",
        candidate: "x",
        critic: {
          pass: false,
          worstSeverity: "major",
          findings: [],
          revisionPrompt: "fix",
          rubricId: "generic-audit-ready",
        },
        revisionPrompt: "fix",
      },
      {
        outcome: "abstain",
        draft: "x",
        reason: "y",
        confidence: 0,
      },
    ];
    for (const c of cases) {
      const env = toResponseEnvelope(c);
      const round = JSON.parse(JSON.stringify(env));
      expect(round).toEqual(env);
    }
  });
});
