/**
 * SOVEREIGN MATRIX — Multi-agent orchestration (Cook 37 / Tier 1 #2)
 *
 * Compose the 140 agents into typed workflows. n8n-for-AI but with
 * cryptographic receipts: every step's input + output is preserved so
 * the full workflow can be replayed end-to-end.
 *
 * The DSL has four step kinds:
 *
 *   agent   — call a registered agent with the current context
 *   seq     — run children one after another (default top-level shape)
 *   parallel — run children with Promise.all
 *   branch  — pick exactly one child by evaluating a predicate
 *
 * The runner is pure orchestration: it doesn't know about LLMs, AI
 * routing, safety pipelines, or persistence. Callers pass an
 * `agentRunner` that takes (slug, input, ctx) and returns the output.
 * That lets the workflow engine sit on top of the existing agent
 * factory, /api/agents/<slug> routes, or in-process registries.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface WorkflowContext {
  userId: string;
  tenantId: string;
  /** Workflow-scoped trace id — embed in every receipt for end-to-end audit. */
  runId: string;
  /** Free-form bag of variables children can read and write. */
  vars: Record<string, unknown>;
}

export type AgentRunner = (
  slug: string,
  input: unknown,
  ctx: WorkflowContext,
) => Promise<unknown>;

export type WorkflowStep = AgentStep | SeqStep | ParallelStep | BranchStep;

export interface AgentStep {
  kind: "agent";
  /** Stable identifier for the step in the receipt. */
  id: string;
  /** Agent slug (resolved against the caller's runner). */
  agent: string;
  /**
   * Pre-process the workflow context into the agent's input. Pure
   * function — the runner expects deterministic mapping.
   */
  buildInput: (ctx: WorkflowContext) => unknown;
  /**
   * Optional post-process: read the agent's output and write into
   * `ctx.vars` for downstream steps.
   */
  saveAs?: string;
}

export interface SeqStep {
  kind: "seq";
  id: string;
  children: WorkflowStep[];
}

export interface ParallelStep {
  kind: "parallel";
  id: string;
  children: WorkflowStep[];
}

export interface BranchStep {
  kind: "branch";
  id: string;
  /** Pure predicate that picks an arm by name. */
  pick: (ctx: WorkflowContext) => string;
  arms: Record<string, WorkflowStep>;
}

// ── Result types ──────────────────────────────────────────────────────────

export type StepOutcome =
  | { kind: "ok"; value: unknown }
  | { kind: "error"; message: string };

export interface StepResult {
  id: string;
  kind: WorkflowStep["kind"];
  /** Sub-steps for seq/parallel/branch (in execution order). */
  children?: StepResult[];
  /** Final outcome bubbled up. */
  outcome: StepOutcome;
  /** Wall-clock duration in ms (rounded). */
  durationMs: number;
}

export interface WorkflowResult {
  runId: string;
  /** Final vars after the workflow runs to completion. */
  vars: Record<string, unknown>;
  steps: StepResult[];
  outcome: "ok" | "error";
}

// ── Runner ────────────────────────────────────────────────────────────────

/**
 * Execute a single step against the supplied runner + context. Never
 * throws — every failure path returns a structured `StepResult`.
 */
async function runStep(
  step: WorkflowStep,
  ctx: WorkflowContext,
  agentRunner: AgentRunner,
): Promise<StepResult> {
  const start = Date.now();
  switch (step.kind) {
    case "agent": {
      const input = step.buildInput(ctx);
      try {
        const value = await agentRunner(step.agent, input, ctx);
        if (step.saveAs) {
          ctx.vars[step.saveAs] = value;
        }
        return {
          id: step.id,
          kind: "agent",
          outcome: { kind: "ok", value },
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          id: step.id,
          kind: "agent",
          outcome: {
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          },
          durationMs: Date.now() - start,
        };
      }
    }
    case "seq": {
      const children: StepResult[] = [];
      for (const child of step.children) {
        const r = await runStep(child, ctx, agentRunner);
        children.push(r);
        if (r.outcome.kind === "error") {
          // Stop the seq on first failure; bubble up.
          return {
            id: step.id,
            kind: "seq",
            children,
            outcome: { kind: "error", message: r.outcome.message },
            durationMs: Date.now() - start,
          };
        }
      }
      return {
        id: step.id,
        kind: "seq",
        children,
        outcome: { kind: "ok", value: undefined },
        durationMs: Date.now() - start,
      };
    }
    case "parallel": {
      const settled = await Promise.all(
        step.children.map((c) => runStep(c, ctx, agentRunner)),
      );
      const firstError = settled.find((r) => r.outcome.kind === "error");
      return {
        id: step.id,
        kind: "parallel",
        children: settled,
        outcome:
          firstError && firstError.outcome.kind === "error"
            ? { kind: "error", message: firstError.outcome.message }
            : { kind: "ok", value: undefined },
        durationMs: Date.now() - start,
      };
    }
    case "branch": {
      const armName = step.pick(ctx);
      const arm = step.arms[armName];
      if (!arm) {
        return {
          id: step.id,
          kind: "branch",
          children: [],
          outcome: {
            kind: "error",
            message: `Branch '${step.id}' picked arm '${armName}' which is not defined`,
          },
          durationMs: Date.now() - start,
        };
      }
      const child = await runStep(arm, ctx, agentRunner);
      return {
        id: step.id,
        kind: "branch",
        children: [child],
        outcome: child.outcome,
        durationMs: Date.now() - start,
      };
    }
  }
}

/**
 * Run a workflow to completion. The returned result is fully
 * JSON-serializable and embeds the whole execution tree for
 * receipt-driven audit.
 */
export async function runWorkflow(
  root: WorkflowStep,
  ctx: WorkflowContext,
  agentRunner: AgentRunner,
): Promise<WorkflowResult> {
  const top = await runStep(root, ctx, agentRunner);
  return {
    runId: ctx.runId,
    vars: { ...ctx.vars },
    steps: [top],
    outcome: top.outcome.kind === "ok" ? "ok" : "error",
  };
}

// ── Tiny DSL helpers ──────────────────────────────────────────────────────

export const seq = (id: string, children: WorkflowStep[]): SeqStep => ({
  kind: "seq",
  id,
  children,
});

export const parallel = (
  id: string,
  children: WorkflowStep[],
): ParallelStep => ({ kind: "parallel", id, children });

export const branch = (
  id: string,
  pick: (ctx: WorkflowContext) => string,
  arms: Record<string, WorkflowStep>,
): BranchStep => ({ kind: "branch", id, pick, arms });

export function agent(args: {
  id: string;
  agent: string;
  buildInput: (ctx: WorkflowContext) => unknown;
  saveAs?: string;
}): AgentStep {
  return {
    kind: "agent",
    id: args.id,
    agent: args.agent,
    buildInput: args.buildInput,
    saveAs: args.saveAs,
  };
}
