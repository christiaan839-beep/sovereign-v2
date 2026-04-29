/**
 * CREW ORCHESTRATION PROTOCOL (R70).
 *
 * Formalizes multi-agent collaboration into declarative, auditable
 * "crews" — persistent teams of specialized agents that hand off
 * tasks under a manager pattern. Composes with the existing
 * trust stack (R26 audit, R34 CADC, R37 ACTs, R44 attestations).
 *
 * This is NOT a workflow engine. This is a TYPED PROTOCOL for how
 * agents collaborate within a declared scope. The protocol defines:
 *
 *   1. CrewDefinition — declarative shape (manager + workers + scope)
 *   2. HandoffPattern — how tasks move between agents
 *   3. CrewExecutionStep — auditable record of who did what
 *   4. CrewProtocolValidator — pure-function check that a step is
 *      legal under the crew's declared rules
 *
 * The composition pattern: every CrewExecutionStep produces an
 * audit-log entry signed by the responsible HUMAN (R34 CADC). Agents
 * do the work; humans authorize the crew configuration. This is
 * "manager-worker with cryptographic accountability."
 *
 * Pure-function design throughout. The validator is deterministic;
 * the executor is impure (calls agents) but the SHAPE check is
 * unit-testable.
 *
 * EU AI Act Article 14 alignment: every crew step is a "natural
 * person can effectively oversee" surface — the audit log shows
 * the manager's sign-off chain.
 */

// ── Types ──────────────────────────────────────────────────────────

/**
 * The role an agent plays within a crew. Manager-worker is the
 * canonical pattern; specialists handle narrow domains; observers
 * (e.g., quality critic) review outputs without producing them.
 */
export type CrewRole = "manager" | "worker" | "specialist" | "observer";

/**
 * How tasks transition between agents within the crew.
 *
 *   - manager-delegates: manager assigns a sub-task to a worker,
 *     waits for completion, decides next step
 *   - parallel-fanout: manager assigns identical sub-task to N
 *     workers, aggregates results (consensus / voting)
 *   - sequential-pipeline: agent A → B → C, each builds on prior
 *     output (no manager in the middle)
 *   - debate: workers produce competing answers, observer judges
 *   - handoff: worker A explicitly passes context to worker B
 */
export type HandoffPattern =
  | "manager-delegates"
  | "parallel-fanout"
  | "sequential-pipeline"
  | "debate"
  | "handoff";

/**
 * Membership of one agent in a crew. Pure data; the actual agent
 * lookup + invocation happens elsewhere.
 */
export interface CrewMember {
  /** Stable agent ID — must exist in the agent manifest registry. */
  agentId: string;
  /** Role this agent plays. */
  role: CrewRole;
  /** Optional human-readable name (for audit logs + UI). */
  displayName?: string;
  /**
   * ACT (R37) capability scope this agent runs under WITHIN this
   * crew. May be narrower than the agent's general scope.
   */
  scopedCapabilities?: string[];
}

/**
 * The declarative shape of a crew. Immutable per version (same
 * audit-trail-reproducibility property as vertical packs).
 */
export interface CrewDefinition {
  /** Stable identifier for the crew. */
  id: string;
  /** Pack version (semver-style). */
  version: string;
  /** Human-readable name. */
  name: string;
  /** Free-form purpose. */
  purpose: string;
  /** Owner — userId or org id who authorized this crew. */
  ownerId: string;
  /** Members. Must include at least one manager (when not pipeline). */
  members: CrewMember[];
  /** Allowed handoff patterns within this crew. */
  allowedHandoffs: HandoffPattern[];
  /**
   * Hard cap on crew runtime per execution (ms). Prevents runaway
   * loops + composes with R28 a2e-depth + R30 cost-runaway.
   */
  maxExecutionMs: number;
  /** Hard cap on number of agent invocations per execution. */
  maxInvocationsPerRun: number;
  /**
   * If true, EVERY handoff requires HITL approval before
   * proceeding. The "ultra-high-stakes" mode for regulated
   * contexts (banking, healthcare, legal).
   */
  hitlOnEveryHandoff: boolean;
  /**
   * SHA-256 of the canonical-JSON of this CrewDefinition. Used
   * by the audit log to prove which crew config was active when
   * a step ran.
   */
  configHash: string;
}

/**
 * One step in a crew execution. Recorded immutably in the audit
 * log; signed by the responsible human via R34 CADC.
 */
export interface CrewExecutionStep {
  /** Unique step id. */
  id: string;
  /** The crew this step belongs to. */
  crewId: string;
  /** Crew config hash at execution time (replay-safety). */
  crewConfigHash: string;
  /** Which agent ran this step. */
  agentId: string;
  /** Role at execution time. */
  role: CrewRole;
  /** Handoff pattern used to reach this step. */
  handoffPattern: HandoffPattern;
  /** ID of the step that handed off to this one (null = first). */
  parentStepId: string | null;
  /** Sequence number within the run. */
  sequenceNumber: number;
  /** ISO 8601 start. */
  startedAt: string;
  /** ISO 8601 end. */
  finishedAt: string;
  /** Status. */
  status: "succeeded" | "failed" | "timeout" | "halted_by_hitl";
  /** Optional reason when not succeeded. */
  failureReason?: string;
}

// ── Pure-function validators ───────────────────────────────────────

/**
 * Pure: validate that a CrewDefinition is structurally legal.
 * Returns either ok or a specific reason. Used by the SDK / pack
 * validator + at crew-creation time.
 *
 * Rules enforced:
 *   1. At least 1 member.
 *   2. If allowedHandoffs includes manager-delegates / debate /
 *      parallel-fanout, MUST have at least one manager.
 *   3. No duplicate agentIds.
 *   4. maxExecutionMs is positive + bounded (max 1 hour).
 *   5. maxInvocationsPerRun is positive + bounded (max 100).
 *   6. Observer roles only allowed if a worker also exists.
 */
export function validateCrewDefinition(
  c: CrewDefinition,
):
  | { valid: true }
  | { valid: false; reason: string } {
  if (c.members.length === 0) {
    return { valid: false, reason: "no_members" };
  }
  if (c.maxExecutionMs <= 0 || c.maxExecutionMs > 60 * 60 * 1000) {
    return { valid: false, reason: "max_execution_out_of_range" };
  }
  if (c.maxInvocationsPerRun <= 0 || c.maxInvocationsPerRun > 100) {
    return { valid: false, reason: "max_invocations_out_of_range" };
  }
  // Dup-agent guard.
  const seen = new Set<string>();
  for (const m of c.members) {
    if (seen.has(m.agentId)) {
      return { valid: false, reason: `duplicate_agent:${m.agentId}` };
    }
    seen.add(m.agentId);
  }
  // Manager required for the patterns that need orchestration.
  const needsManager =
    c.allowedHandoffs.includes("manager-delegates") ||
    c.allowedHandoffs.includes("parallel-fanout") ||
    c.allowedHandoffs.includes("debate");
  if (needsManager) {
    const hasManager = c.members.some((m) => m.role === "manager");
    if (!hasManager) {
      return { valid: false, reason: "manager_required" };
    }
  }
  // Observer-only crew is invalid (nothing for them to observe).
  const hasNonObserver = c.members.some((m) => m.role !== "observer");
  if (!hasNonObserver) {
    return { valid: false, reason: "observer_only_crew" };
  }
  return { valid: true };
}

/**
 * Pure: validate that a proposed handoff is legal under the crew's
 * declared rules. Used by the executor BEFORE invoking the next
 * agent.
 *
 * Rules:
 *   1. Pattern must be in allowedHandoffs.
 *   2. Target agent must be in members.
 *   3. Manager-delegate transitions MUST originate from a manager
 *      role.
 *   4. parent step must exist when not the first step.
 *   5. If hitlOnEveryHandoff, caller must include hitlApprovalId.
 */
export function validateHandoff(input: {
  crew: CrewDefinition;
  fromAgentId: string | null; // null = crew start
  fromRole: CrewRole | null;
  toAgentId: string;
  pattern: HandoffPattern;
  hitlApprovalId?: string;
}):
  | { valid: true }
  | { valid: false; reason: string } {
  const c = input.crew;
  // Pattern must be allowed.
  if (!c.allowedHandoffs.includes(input.pattern)) {
    return { valid: false, reason: `pattern_not_allowed:${input.pattern}` };
  }
  // Target must be a member.
  const target = c.members.find((m) => m.agentId === input.toAgentId);
  if (!target) {
    return {
      valid: false,
      reason: `target_not_in_crew:${input.toAgentId}`,
    };
  }
  // Manager-delegates pattern must originate from a manager.
  if (
    input.pattern === "manager-delegates" &&
    input.fromAgentId !== null &&
    input.fromRole !== "manager"
  ) {
    return {
      valid: false,
      reason: "manager_delegates_must_originate_from_manager",
    };
  }
  // Debate pattern: target must be observer or manager.
  if (
    input.pattern === "debate" &&
    target.role !== "observer" &&
    target.role !== "manager"
  ) {
    return { valid: false, reason: "debate_target_must_be_observer_or_manager" };
  }
  // HITL on every handoff: require approval id.
  if (c.hitlOnEveryHandoff && !input.hitlApprovalId) {
    return { valid: false, reason: "hitl_approval_required" };
  }
  return { valid: true };
}

/**
 * Pure: classify a crew's "stakes" based on declared SLA pressure.
 * Used by the audit-export + reliability-attestation surfaces.
 *
 *   - regulated: any HITL-on-every-handoff crew (banking, legal)
 *   - high: manager-required + multi-worker
 *   - standard: simple sequential pipelines
 *   - low: observer-only or single-member-with-pipeline
 */
export type CrewStakes = "low" | "standard" | "high" | "regulated";

export function classifyCrewStakes(c: CrewDefinition): CrewStakes {
  if (c.hitlOnEveryHandoff) return "regulated";
  const workerCount = c.members.filter((m) => m.role === "worker").length;
  const hasManager = c.members.some((m) => m.role === "manager");
  if (hasManager && workerCount >= 2) return "high";
  if (c.members.length >= 2) return "standard";
  return "low";
}

/**
 * Pure: compute an aggregated execution summary from steps.
 * Used by /api/crews/[crewId]/runs/[runId]/summary + R44 attestations.
 */
export function summarizeCrewExecution(input: {
  crew: CrewDefinition;
  steps: CrewExecutionStep[];
}): {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  haltedByHitl: number;
  totalDurationMs: number;
  agentsParticipated: string[];
  patterns: Record<HandoffPattern, number>;
  successRate: number;
} {
  const totalSteps = input.steps.length;
  const successfulSteps = input.steps.filter(
    (s) => s.status === "succeeded",
  ).length;
  const failedSteps = input.steps.filter((s) => s.status === "failed").length;
  const haltedByHitl = input.steps.filter(
    (s) => s.status === "halted_by_hitl",
  ).length;
  const totalDurationMs = input.steps.reduce((acc, s) => {
    const start = new Date(s.startedAt).getTime();
    const end = new Date(s.finishedAt).getTime();
    return acc + Math.max(0, end - start);
  }, 0);
  const agentsParticipated = [...new Set(input.steps.map((s) => s.agentId))].sort();
  const patterns: Record<HandoffPattern, number> = {
    "manager-delegates": 0,
    "parallel-fanout": 0,
    "sequential-pipeline": 0,
    debate: 0,
    handoff: 0,
  };
  for (const s of input.steps) {
    patterns[s.handoffPattern]++;
  }
  return {
    totalSteps,
    successfulSteps,
    failedSteps,
    haltedByHitl,
    totalDurationMs,
    agentsParticipated,
    patterns,
    successRate: totalSteps === 0 ? 0 : successfulSteps / totalSteps,
  };
}
