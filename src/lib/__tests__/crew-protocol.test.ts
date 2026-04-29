/**
 * orchestration/crew-protocol (R70) — tests.
 *
 * Pure-function multi-agent collaboration protocol. Validates
 * crew definitions, handoff legality, stakes classification,
 * and execution summarization.
 *
 * Covers:
 *   - validateCrewDefinition: structural legality
 *     * empty members → reject
 *     * manager-required patterns without manager → reject
 *     * observer-only crew → reject
 *     * duplicate agentIds → reject
 *     * out-of-range execution + invocation caps → reject
 *   - validateHandoff: per-step legality
 *     * pattern not in allowedHandoffs → reject
 *     * target not in crew → reject
 *     * manager-delegates from non-manager → reject
 *     * debate target must be observer or manager
 *     * hitlOnEveryHandoff requires approval id
 *   - classifyCrewStakes: regulated / high / standard / low
 *   - summarizeCrewExecution: aggregate stats correct
 */

import { describe, it, expect } from "vitest";
import {
  validateCrewDefinition,
  validateHandoff,
  classifyCrewStakes,
  summarizeCrewExecution,
  type CrewDefinition,
  type CrewExecutionStep,
} from "../orchestration/crew-protocol";

const baseCrew = (override: Partial<CrewDefinition> = {}): CrewDefinition => ({
  id: "go-to-market-crew-v1",
  version: "1.0.0",
  name: "GTM Crew",
  purpose: "Lead generation + content + outreach",
  ownerId: "user_alice",
  members: [
    { agentId: "manager-1", role: "manager" },
    { agentId: "lead-researcher", role: "worker" },
    { agentId: "content-writer", role: "worker" },
  ],
  allowedHandoffs: ["manager-delegates", "sequential-pipeline"],
  maxExecutionMs: 10 * 60 * 1000, // 10 minutes
  maxInvocationsPerRun: 20,
  hitlOnEveryHandoff: false,
  configHash: "sha256-fake",
  ...override,
});

describe("validateCrewDefinition — structural legality", () => {
  it("accepts a valid crew with manager + workers", () => {
    expect(validateCrewDefinition(baseCrew()).valid).toBe(true);
  });

  it("rejects empty members", () => {
    const r = validateCrewDefinition(baseCrew({ members: [] }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("no_members");
  });

  it("rejects when manager required but none present", () => {
    const r = validateCrewDefinition(
      baseCrew({
        members: [
          { agentId: "worker-1", role: "worker" },
          { agentId: "worker-2", role: "worker" },
        ],
        allowedHandoffs: ["manager-delegates"],
      }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("manager_required");
  });

  it("rejects observer-only crew (nothing to observe)", () => {
    const r = validateCrewDefinition(
      baseCrew({
        members: [{ agentId: "observer-1", role: "observer" }],
        allowedHandoffs: ["sequential-pipeline"],
      }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("observer_only_crew");
  });

  it("rejects duplicate agent ids", () => {
    const r = validateCrewDefinition(
      baseCrew({
        members: [
          { agentId: "manager-1", role: "manager" },
          { agentId: "manager-1", role: "worker" }, // dup
        ],
      }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain("duplicate_agent");
  });

  it("rejects out-of-range maxExecutionMs (negative)", () => {
    const r = validateCrewDefinition(baseCrew({ maxExecutionMs: -1 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("max_execution_out_of_range");
  });

  it("rejects out-of-range maxExecutionMs (over 1 hour)", () => {
    const r = validateCrewDefinition(
      baseCrew({ maxExecutionMs: 2 * 60 * 60 * 1000 }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("max_execution_out_of_range");
  });

  it("rejects out-of-range maxInvocationsPerRun", () => {
    const r = validateCrewDefinition(baseCrew({ maxInvocationsPerRun: 200 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("max_invocations_out_of_range");
  });

  it("accepts sequential-pipeline crew without manager", () => {
    const r = validateCrewDefinition(
      baseCrew({
        members: [
          { agentId: "stage-1", role: "worker" },
          { agentId: "stage-2", role: "worker" },
        ],
        allowedHandoffs: ["sequential-pipeline"],
      }),
    );
    expect(r.valid).toBe(true);
  });
});

describe("validateHandoff — per-step legality", () => {
  it("accepts manager-delegates from manager to worker", () => {
    const r = validateHandoff({
      crew: baseCrew(),
      fromAgentId: "manager-1",
      fromRole: "manager",
      toAgentId: "lead-researcher",
      pattern: "manager-delegates",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects pattern not in allowedHandoffs", () => {
    const r = validateHandoff({
      crew: baseCrew({ allowedHandoffs: ["sequential-pipeline"] }),
      fromAgentId: "manager-1",
      fromRole: "manager",
      toAgentId: "lead-researcher",
      pattern: "manager-delegates",
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain("pattern_not_allowed");
  });

  it("rejects target not in crew (anti-leak)", () => {
    const r = validateHandoff({
      crew: baseCrew(),
      fromAgentId: "manager-1",
      fromRole: "manager",
      toAgentId: "external-agent",
      pattern: "manager-delegates",
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain("target_not_in_crew");
  });

  it("rejects manager-delegates originating from a worker", () => {
    const r = validateHandoff({
      crew: baseCrew(),
      fromAgentId: "lead-researcher",
      fromRole: "worker",
      toAgentId: "content-writer",
      pattern: "manager-delegates",
    });
    expect(r.valid).toBe(false);
    if (!r.valid)
      expect(r.reason).toBe("manager_delegates_must_originate_from_manager");
  });

  it("debate target must be observer or manager", () => {
    const crew = baseCrew({
      members: [
        { agentId: "mgr", role: "manager" },
        { agentId: "w1", role: "worker" },
        { agentId: "w2", role: "worker" },
        { agentId: "judge", role: "observer" },
      ],
      allowedHandoffs: ["debate"],
    });
    // workers debating each other's outputs → not allowed
    const r1 = validateHandoff({
      crew,
      fromAgentId: "w1",
      fromRole: "worker",
      toAgentId: "w2",
      pattern: "debate",
    });
    expect(r1.valid).toBe(false);
    // worker → observer (judge): allowed
    const r2 = validateHandoff({
      crew,
      fromAgentId: "w1",
      fromRole: "worker",
      toAgentId: "judge",
      pattern: "debate",
    });
    expect(r2.valid).toBe(true);
  });

  it("hitlOnEveryHandoff requires approval id", () => {
    const r = validateHandoff({
      crew: baseCrew({ hitlOnEveryHandoff: true }),
      fromAgentId: "manager-1",
      fromRole: "manager",
      toAgentId: "lead-researcher",
      pattern: "manager-delegates",
      // hitlApprovalId omitted
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("hitl_approval_required");
  });

  it("accepts hitlOnEveryHandoff when approval id provided", () => {
    const r = validateHandoff({
      crew: baseCrew({ hitlOnEveryHandoff: true }),
      fromAgentId: "manager-1",
      fromRole: "manager",
      toAgentId: "lead-researcher",
      pattern: "manager-delegates",
      hitlApprovalId: "approval-abc",
    });
    expect(r.valid).toBe(true);
  });

  it("first step (fromAgentId=null) bypasses manager-origin check", () => {
    const r = validateHandoff({
      crew: baseCrew(),
      fromAgentId: null,
      fromRole: null,
      toAgentId: "manager-1",
      pattern: "manager-delegates",
    });
    expect(r.valid).toBe(true);
  });
});

describe("classifyCrewStakes", () => {
  it("hitlOnEveryHandoff → regulated", () => {
    expect(classifyCrewStakes(baseCrew({ hitlOnEveryHandoff: true }))).toBe(
      "regulated",
    );
  });

  it("manager + 2+ workers (no HITL) → high", () => {
    expect(classifyCrewStakes(baseCrew())).toBe("high");
  });

  it("multi-member without manager → standard", () => {
    expect(
      classifyCrewStakes(
        baseCrew({
          members: [
            { agentId: "a", role: "worker" },
            { agentId: "b", role: "worker" },
          ],
          allowedHandoffs: ["sequential-pipeline"],
        }),
      ),
    ).toBe("standard");
  });

  it("single-member crew → low", () => {
    expect(
      classifyCrewStakes(
        baseCrew({
          members: [{ agentId: "solo", role: "worker" }],
          allowedHandoffs: ["sequential-pipeline"],
        }),
      ),
    ).toBe("low");
  });
});

describe("summarizeCrewExecution", () => {
  function step(
    overrides: Partial<CrewExecutionStep> = {},
  ): CrewExecutionStep {
    return {
      id: "step-1",
      crewId: "crew-1",
      crewConfigHash: "sha-x",
      agentId: "manager-1",
      role: "manager",
      handoffPattern: "manager-delegates",
      parentStepId: null,
      sequenceNumber: 1,
      startedAt: "2026-04-29T10:00:00.000Z",
      finishedAt: "2026-04-29T10:00:05.000Z",
      status: "succeeded",
      ...overrides,
    };
  }

  it("empty steps → totals are 0, successRate is 0", () => {
    const s = summarizeCrewExecution({ crew: baseCrew(), steps: [] });
    expect(s.totalSteps).toBe(0);
    expect(s.successRate).toBe(0);
  });

  it("aggregates totals + duration correctly", () => {
    const steps = [
      step({ id: "s1", agentId: "manager-1", status: "succeeded" }),
      step({
        id: "s2",
        agentId: "lead-researcher",
        status: "succeeded",
        startedAt: "2026-04-29T10:00:05.000Z",
        finishedAt: "2026-04-29T10:00:15.000Z",
      }),
      step({
        id: "s3",
        agentId: "content-writer",
        status: "failed",
        failureReason: "timeout",
        startedAt: "2026-04-29T10:00:15.000Z",
        finishedAt: "2026-04-29T10:00:30.000Z",
      }),
    ];
    const s = summarizeCrewExecution({ crew: baseCrew(), steps });
    expect(s.totalSteps).toBe(3);
    expect(s.successfulSteps).toBe(2);
    expect(s.failedSteps).toBe(1);
    expect(s.totalDurationMs).toBe(5000 + 10_000 + 15_000);
    expect(s.agentsParticipated).toEqual([
      "content-writer",
      "lead-researcher",
      "manager-1",
    ]);
    expect(s.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("counts halted_by_hitl separately", () => {
    const steps = [
      step({ status: "halted_by_hitl" }),
      step({ status: "halted_by_hitl" }),
    ];
    const s = summarizeCrewExecution({ crew: baseCrew(), steps });
    expect(s.haltedByHitl).toBe(2);
    expect(s.successfulSteps).toBe(0);
  });

  it("counts patterns by category", () => {
    const steps = [
      step({ handoffPattern: "manager-delegates" }),
      step({ handoffPattern: "manager-delegates" }),
      step({ handoffPattern: "sequential-pipeline" }),
      step({ handoffPattern: "debate" }),
    ];
    const s = summarizeCrewExecution({ crew: baseCrew(), steps });
    expect(s.patterns["manager-delegates"]).toBe(2);
    expect(s.patterns["sequential-pipeline"]).toBe(1);
    expect(s.patterns.debate).toBe(1);
    expect(s.patterns.handoff).toBe(0);
  });
});
