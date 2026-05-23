/**
 * SOVEREIGN MATRIX — DAG Playbook Executor (wave 115 M5)
 *
 * Why this exists:
 *   The for-loop in `src/app/api/playbooks/run/route.ts:127-184` runs each
 *   step strictly sequentially. Every playbook is the same shape: step N
 *   waits for step N-1. That works for the "one feed, one agent" case but
 *   blocks the marketing claim of "multi-agent OS with parallel fanout."
 *   `swarm-protocol.ts` runs parallel agents on the same goal but it's a
 *   consensus engine, not a workflow engine — never wired into playbooks.
 *
 *   This module is the DAG executor itself. Steps declare what they depend
 *   on (`dependsOn: number[]`), optional conditional edges (`condition`),
 *   and an optional-failure mode. The runner fires every step whose
 *   dependencies are satisfied in parallel — up to `maxConcurrency` —
 *   resolves `condition` against parent outputs to skip non-matching
 *   branches, and propagates failure to downstream steps (unless the
 *   failed step was marked `optional`).
 *
 * Backwards-compat contract:
 *   - If `dependsOn` is omitted on step i, defaults to `[i - 1]` (or `[]`
 *     for the first step). That makes a playbook with `dag: true` but no
 *     declared dependencies behave identically to the for-loop today.
 *   - The host of this executor (the playbook route) opts in via a
 *     per-playbook `dag: true` flag. Existing 35 playbooks stay on the
 *     for-loop until they explicitly declare DAG structure.
 *
 * Failure semantics:
 *   - On step failure: mark step "failed", record error, do not fire any
 *     descendant whose required ancestor failed. Descendant is recorded
 *     as "skipped" with reason "ancestor-failed".
 *   - If the failed step is marked `optional: true`, its output becomes
 *     "" and descendants proceed.
 *
 * Concurrency safety:
 *   - The executor uses promise polling (`Promise.race` on the in-flight
 *     set), so a single slow step doesn't block independent branches.
 *   - `maxConcurrency` caps the number of `runStep` calls in flight at
 *     any instant. Default 8 — enough for fan-out, low enough not to
 *     blow up Vercel's serverless concurrency budget.
 *
 * Wall-clock budget:
 *   - `totalTimeoutMs` (default 5 minutes) starts when `executeDag` is
 *     called. On expiry, all unfinished steps are marked "failed" with
 *     the reason "dag-wall-clock". Outputs from completed steps stand.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("dag-executor");

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DagStep {
  /** Agent name (must match a route under /api/agents/*). */
  agent: string;
  /** Template-resolved params for the agent call. */
  params: Record<string, string>;
  /** Optional human-readable purpose. Surfaced in DB + logs. */
  reason?: string;
  /**
   * Indices of steps this step waits for. Omit to default to `[i - 1]`
   * (the linear / for-loop behaviour). Use `[]` to make the step
   * independent of all earlier steps (a true fan-out root).
   */
  dependsOn?: number[];
  /**
   * Conditional edge — skip this step unless the parent step's output
   * satisfies the predicate. Exactly one of `contains` / `equals` is
   * inspected. Comparison is case-insensitive.
   */
  condition?: {
    ifStep: number;
    contains?: string;
    equals?: string;
  };
  /**
   * When true, a `failed` status on this step does NOT cause downstream
   * steps to be skipped. The failed step's output becomes "" so
   * descendants can still reference `{{step_N}}` without breaking.
   */
  optional?: boolean;
}

export interface DagStepResult {
  index: number;
  agent: string;
  status: "done" | "failed" | "skipped";
  output: string;
  durationMs: number;
  error?: string;
  /** Reason for a `skipped` status: "condition-not-met" | "ancestor-failed" | "dag-wall-clock". */
  skipReason?: string;
}

export interface DagRunResult {
  succeeded: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  results: DagStepResult[];
}

export type DagStateChangeHook = (
  index: number,
  state: "running" | "done" | "failed" | "skipped",
  payload?: {
    output?: string;
    error?: string;
    durationMs?: number;
    skipReason?: string;
  },
) => void | Promise<void>;

export interface ExecuteDagOptions {
  /**
   * Per-step runner. Called once per step that's eligible to execute
   * (dependencies satisfied, condition met). Receives the resolved
   * step + the outputs of its parents indexed by step number, so the
   * caller can substitute `{{step_N}}` templates or otherwise inject
   * context. Must return the step's output as a string.
   */
  runStep: (
    step: DagStep,
    index: number,
    parentOutputs: Record<number, string>,
  ) => Promise<string>;
  /**
   * Hook called as each step transitions states. Used by the playbook
   * route to write `playbook_run_steps` rows in real-time so the UI
   * can light up steps as they fire.
   */
  onStateChange?: DagStateChangeHook;
  /** Hard wall-clock cap on the entire DAG. Default 5 minutes. */
  totalTimeoutMs?: number;
  /** Max steps running concurrently. Default 8. */
  maxConcurrency?: number;
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Resolve `dependsOn` with the for-loop default: step i defaults to
 * waiting on step i-1 (or [] when i === 0). This is what makes a DAG
 * playbook with no declared deps behave identically to the legacy
 * for-loop runner.
 */
export function normalisedDependsOn(step: DagStep, index: number): number[] {
  if (step.dependsOn !== undefined) return [...step.dependsOn];
  return index === 0 ? [] : [index - 1];
}

/**
 * Detect cycles + invalid indices in the DAG. Throws on the first
 * problem found so the caller can return a 400 to the user before
 * starting any execution.
 */
export function validateDag(steps: DagStep[]): void {
  // Index range check
  for (let i = 0; i < steps.length; i++) {
    const deps = normalisedDependsOn(steps[i], i);
    for (const d of deps) {
      if (!Number.isInteger(d) || d < 0 || d >= steps.length) {
        throw new Error(`step ${i} depends on out-of-range index ${d}`);
      }
      if (d === i) {
        throw new Error(`step ${i} depends on itself`);
      }
      if (d > i) {
        // Forward dependency — allowed in a true DAG but unusual; we
        // accept it. The topological sort handles ordering. The for-
        // loop default never produces this shape.
      }
    }
    if (steps[i].condition) {
      const ifStep = steps[i].condition!.ifStep;
      if (!Number.isInteger(ifStep) || ifStep < 0 || ifStep >= steps.length) {
        throw new Error(
          `step ${i} condition references out-of-range index ${ifStep}`,
        );
      }
    }
  }
  // Cycle detection (Tarjan-style DFS)
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Array(steps.length).fill(WHITE);
  const stack: Array<{ node: number; depIdx: number }> = [];
  for (let start = 0; start < steps.length; start++) {
    if (color[start] !== WHITE) continue;
    stack.push({ node: start, depIdx: 0 });
    color[start] = GRAY;
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const deps = normalisedDependsOn(steps[top.node], top.node);
      if (top.depIdx >= deps.length) {
        color[top.node] = BLACK;
        stack.pop();
        continue;
      }
      const next = deps[top.depIdx];
      top.depIdx++;
      if (color[next] === GRAY) {
        throw new Error(
          `cycle detected: step ${next} → ... → step ${top.node} → step ${next}`,
        );
      }
      if (color[next] === WHITE) {
        color[next] = GRAY;
        stack.push({ node: next, depIdx: 0 });
      }
    }
  }
}

// ─── Conditional edge evaluation ───────────────────────────────────────────

function conditionMet(step: DagStep, outputs: Record<number, string>): boolean {
  const c = step.condition;
  if (!c) return true;
  const parent = outputs[c.ifStep];
  if (typeof parent !== "string") return false;
  const haystack = parent.toLowerCase();
  if (c.contains !== undefined) {
    return haystack.includes(c.contains.toLowerCase());
  }
  if (c.equals !== undefined) {
    return haystack === c.equals.toLowerCase();
  }
  // Neither predicate set — treat as no-op (executes).
  return true;
}

// ─── Main executor ─────────────────────────────────────────────────────────

const DEFAULT_TOTAL_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_CONCURRENCY = 8;

/**
 * Run a DAG of agent calls to completion (or timeout).
 *
 * Returns aggregate stats + per-step results in declaration order. The
 * caller is responsible for translating outputs back to the persistence
 * layer; `onStateChange` is the recommended hook for that.
 */
export async function executeDag(
  steps: DagStep[],
  opts: ExecuteDagOptions,
): Promise<DagRunResult> {
  validateDag(steps);

  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  const maxConcurrency = Math.max(
    1,
    opts.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
  );
  const start = Date.now();
  const deadline = start + totalTimeoutMs;

  // Per-step bookkeeping
  type State = "pending" | "running" | "done" | "failed" | "skipped";
  const state: State[] = new Array(steps.length).fill("pending");
  const outputs: Record<number, string> = {};
  const errors: Record<number, string> = {};
  const durations: Record<number, number> = {};
  const skipReasons: Record<number, string> = {};

  const notify = async (
    index: number,
    nextState: "running" | "done" | "failed" | "skipped",
    payload?: {
      output?: string;
      error?: string;
      durationMs?: number;
      skipReason?: string;
    },
  ) => {
    state[index] = nextState;
    if (opts.onStateChange) {
      try {
        await opts.onStateChange(index, nextState, payload);
      } catch (hookErr) {
        // Don't let a misbehaving hook abort the DAG. The state update
        // already happened in-memory.
        log.warn("onStateChange hook threw", {
          index,
          nextState,
          error: String(hookErr),
        });
      }
    }
  };

  const dependenciesSatisfied = (i: number): boolean => {
    const deps = normalisedDependsOn(steps[i], i);
    // A dep is "resolved" once it reaches any terminal state. "failed"
    // is included so the scheduler gets a chance to run
    // `anyRequiredAncestorFailed` and propagate the skip downstream —
    // otherwise descendants of a failed step stay pending forever and
    // never get a `skipped` status emitted.
    return deps.every(
      (d) =>
        state[d] === "done" || state[d] === "skipped" || state[d] === "failed",
    );
  };

  const anyRequiredAncestorFailed = (i: number): boolean => {
    // BFS upward through dependsOn graph. If ANY transitive parent has
    // status "failed" AND was not marked optional, propagate skip.
    const visited = new Set<number>();
    const queue = [...normalisedDependsOn(steps[i], i)];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (state[node] === "failed" && !steps[node].optional) return true;
      queue.push(...normalisedDependsOn(steps[node], node));
    }
    return false;
  };

  const collectParentOutputs = (i: number): Record<number, string> => {
    const result: Record<number, string> = {};
    const visited = new Set<number>();
    const queue = [...normalisedDependsOn(steps[i], i)];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (outputs[node] !== undefined) result[node] = outputs[node];
      queue.push(...normalisedDependsOn(steps[node], node));
    }
    return result;
  };

  type InFlight = {
    index: number;
    promise: Promise<{ index: number; output: string }>;
  };
  const inFlight = new Map<number, InFlight>();

  // Schedule everything that can be scheduled right now. Returns the
  // number of new steps put into flight.
  const scheduleReady = async (): Promise<number> => {
    let scheduled = 0;
    for (let i = 0; i < steps.length; i++) {
      if (state[i] !== "pending") continue;
      if (inFlight.size >= maxConcurrency) break;
      if (!dependenciesSatisfied(i)) continue;

      // Ancestor failed (and was required) → skip this step.
      if (anyRequiredAncestorFailed(i)) {
        durations[i] = 0;
        skipReasons[i] = "ancestor-failed";
        await notify(i, "skipped", {
          durationMs: 0,
          skipReason: "ancestor-failed",
        });
        continue;
      }

      // Conditional edge — evaluate against the relevant parent.
      if (!conditionMet(steps[i], outputs)) {
        durations[i] = 0;
        skipReasons[i] = "condition-not-met";
        await notify(i, "skipped", {
          durationMs: 0,
          skipReason: "condition-not-met",
        });
        continue;
      }

      // Eligible — fire it.
      const stepStart = Date.now();
      await notify(i, "running");
      const parents = collectParentOutputs(i);
      const idx = i;
      const promise = opts.runStep(steps[idx], idx, parents).then(
        (output) => ({ index: idx, output }),
        (err) => {
          // Convert rejections into failed-step records so the Promise
          // resolution path is uniform.
          errors[idx] = err instanceof Error ? err.message : String(err);
          return { index: idx, output: "" };
        },
      );
      inFlight.set(idx, { index: idx, promise });
      scheduled++;
      // Track the start time so we record duration on completion.
      durations[idx] = stepStart;
    }
    return scheduled;
  };

  // Main scheduling loop.
  await scheduleReady();
  while (inFlight.size > 0) {
    if (Date.now() > deadline) {
      // Wall-clock budget exceeded — mark remaining pending + running as failed.
      for (let i = 0; i < steps.length; i++) {
        if (state[i] === "pending" || state[i] === "running") {
          errors[i] = "dag-wall-clock";
          durations[i] = Date.now() - start;
          await notify(i, "failed", {
            error: "dag-wall-clock",
            durationMs: durations[i],
          });
        }
      }
      break;
    }

    // Race the in-flight set against a short timer so we re-check the
    // wall-clock budget at least every second.
    let nextCheckTimer: ReturnType<typeof setTimeout> | undefined;
    const tick: Promise<"timer"> = new Promise((resolve) => {
      nextCheckTimer = setTimeout(() => resolve("timer"), 1000);
    });
    const completed = await Promise.race([
      ...Array.from(inFlight.values()).map((f) => f.promise),
      tick,
    ]);
    if (nextCheckTimer !== undefined) clearTimeout(nextCheckTimer);

    if (completed === "timer") {
      continue;
    }

    const finishedIdx = (completed as { index: number; output: string }).index;
    const finishedOutput = (completed as { index: number; output: string })
      .output;
    inFlight.delete(finishedIdx);

    const stepStart = durations[finishedIdx];
    const durationMs = Date.now() - stepStart;
    durations[finishedIdx] = durationMs;

    if (errors[finishedIdx]) {
      // The runStep promise rejected. If the step is optional, treat
      // output as "" and let descendants run; otherwise mark failed
      // and let scheduleReady propagate the skip downstream.
      if (steps[finishedIdx].optional) {
        outputs[finishedIdx] = "";
        await notify(finishedIdx, "done", {
          output: "",
          durationMs,
          error: errors[finishedIdx],
        });
      } else {
        await notify(finishedIdx, "failed", {
          error: errors[finishedIdx],
          durationMs,
        });
      }
    } else {
      outputs[finishedIdx] = finishedOutput;
      await notify(finishedIdx, "done", { output: finishedOutput, durationMs });
    }

    await scheduleReady();
  }

  // Tally + return.
  const results: DagStepResult[] = steps.map((step, i) => ({
    index: i,
    agent: step.agent,
    status:
      state[i] === "pending"
        ? "skipped"
        : (state[i] as DagStepResult["status"]),
    output: outputs[i] ?? "",
    durationMs: typeof durations[i] === "number" ? durations[i] : 0,
    error: errors[i],
    skipReason: skipReasons[i],
  }));

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const r of results) {
    if (r.status === "done") succeeded++;
    else if (r.status === "failed") failed++;
    else if (r.status === "skipped") skipped++;
  }

  return {
    succeeded,
    failed,
    skipped,
    totalDurationMs: Date.now() - start,
    results,
  };
}
