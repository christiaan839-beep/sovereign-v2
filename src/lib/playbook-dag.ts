/**
 * SOVEREIGN MATRIX — Playbook DAG scheduler
 *
 * Playbook steps already declare their data dependencies: a step that
 * needs an earlier step's output embeds a `{{step_N}}` template in its
 * params. Until wave 112 the executor ignored that declaration and ran
 * every step in a strict `for`-loop, so:
 *
 *   1. Independent steps were serialised for no reason.
 *   2. A step whose input failed still ran, against empty context —
 *      burning a model call to synthesise nothing.
 *
 * This module turns those `{{step_N}}` references into a real dependency
 * graph and schedules it with bounded concurrency.
 *
 * ── Indexing contract ───────────────────────────────────────────────
 * `{{step_N}}` is **1-indexed** — it is authored by humans writing
 * playbook definitions, and `{{step_1}}` means "the first step".
 * Internally everything is 0-indexed, so the dependency is `N - 1`.
 * (Before wave 112 the executor read `{{step_N}}` as `outputs[N]`, so
 * 33 of 37 references across 25 playbooks resolved to the referencing
 * step's own not-yet-written output and silently interpolated "".)
 *
 * The scheduler is deliberately free of DB and HTTP concerns: callers
 * inject a `runStep` function, which makes the whole thing unit-testable.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("playbook-dag");

/** Matches an author-facing, 1-indexed step reference. */
const STEP_REF = /\{\{step_(\d+)\}\}/g;

export type StepStatus = "done" | "failed" | "skipped";

export interface DagNode {
  /** 0-indexed position in the playbook's step array. */
  index: number;
  /** 0-indexed steps this one consumes output from. Always < index. */
  deps: number[];
  /**
   * True when `deps` came from explicit `{{step_N}}` references.
   * False means the node inherited the implicit "previous step" edge,
   * which preserves pre-wave-112 behaviour for steps that declare nothing.
   */
  explicit: boolean;
}

export interface DagBuild {
  nodes: DagNode[];
  /** Human-readable notes about references that were dropped. */
  warnings: string[];
}

export type StepOutcome =
  | { status: "done"; output: string }
  | { status: "failed"; error: string };

export interface DagRunResult {
  outputs: Record<number, string>;
  statuses: Record<number, StepStatus>;
  succeeded: number;
  failed: number;
  skipped: number;
  /** Widest set of steps that were in flight at once. */
  maxParallelism: number;
}

/**
 * Extract the 0-indexed dependencies declared by a step's params.
 *
 * References that cannot be satisfied are dropped rather than thrown —
 * a malformed playbook definition must not take down a user's run. Each
 * drop is reported so the caller can log it.
 */
export function parseStepRefs(
  params: Record<string, string>,
  ownIndex: number,
  stepCount: number,
): { deps: number[]; warnings: string[] } {
  const deps = new Set<number>();
  const warnings: string[] = [];

  for (const value of Object.values(params)) {
    if (typeof value !== "string") continue;
    for (const match of value.matchAll(STEP_REF)) {
      const oneIndexed = Number.parseInt(match[1], 10);
      const dep = oneIndexed - 1;

      if (!Number.isFinite(oneIndexed) || oneIndexed < 1) {
        warnings.push(
          `step ${ownIndex}: {{step_${match[1]}}} is not a valid 1-indexed reference`,
        );
        continue;
      }
      if (dep >= stepCount) {
        warnings.push(
          `step ${ownIndex}: {{step_${oneIndexed}}} points past the last step (${stepCount})`,
        );
        continue;
      }
      if (dep === ownIndex) {
        warnings.push(
          `step ${ownIndex}: {{step_${oneIndexed}}} refers to itself`,
        );
        continue;
      }
      if (dep > ownIndex) {
        warnings.push(
          `step ${ownIndex}: {{step_${oneIndexed}}} refers to a later step`,
        );
        continue;
      }
      deps.add(dep);
    }
  }

  return { deps: [...deps].sort((a, b) => a - b), warnings };
}

/**
 * Build the dependency graph for a playbook's steps.
 *
 * Because forward and self references are dropped in `parseStepRefs`,
 * every surviving edge points strictly backwards — the graph is acyclic
 * by construction. `executeDag` still fails closed if that ever changes.
 */
export function buildPlaybookDag(
  steps: Array<{ params: Record<string, string> }>,
): DagBuild {
  const nodes: DagNode[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const { deps, warnings: w } = parseStepRefs(
      steps[i].params ?? {},
      i,
      steps.length,
    );
    warnings.push(...w);

    if (deps.length > 0) {
      nodes.push({ index: i, deps, explicit: true });
    } else {
      // No declared inputs — keep the historical sequential edge so
      // playbooks that relied on implicit "previous step" context
      // behave exactly as they did before wave 112.
      nodes.push({ index: i, deps: i > 0 ? [i - 1] : [], explicit: false });
    }
  }

  return { nodes, warnings };
}

/**
 * Substitute `{{step_N}}` references with the referenced step's output.
 *
 * `outputs` is keyed by 0-indexed step position; `{{step_N}}` reads
 * `outputs[N - 1]`. A reference with no recorded output collapses to ""
 * (the step was skipped or produced nothing).
 */
export function resolveStepParams(
  params: Record<string, string>,
  outputs: Record<number, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    resolved[key] =
      typeof value === "string"
        ? value.replace(
            STEP_REF,
            (_m, n: string) => outputs[Number.parseInt(n, 10) - 1] ?? "",
          )
        : value;
  }
  return resolved;
}

function readConcurrency(): number {
  const raw = Number.parseInt(process.env.PLAYBOOK_MAX_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return 4;
  return Math.min(raw, 16);
}

/**
 * Run a dependency graph with bounded concurrency.
 *
 * A node runs once every dependency has completed successfully. If any
 * dependency failed or was itself skipped, the node is skipped — running
 * a synthesis step against missing input produces garbage and still costs
 * a model call.
 *
 * `runStep` receives the outputs of that node's dependencies. Errors it
 * throws are captured as a failed step; one bad step never rejects the
 * whole run.
 */
export async function executeDag(
  nodes: DagNode[],
  runStep: (
    index: number,
    depOutputs: Record<number, string>,
  ) => Promise<StepOutcome>,
  opts: {
    concurrency?: number;
    onSkip?: (index: number, reason: string) => void | Promise<void>;
  } = {},
): Promise<DagRunResult> {
  const concurrency = opts.concurrency ?? readConcurrency();
  const outputs: Record<number, string> = {};
  const statuses: Record<number, StepStatus> = {};
  const byIndex = new Map(nodes.map((n) => [n.index, n]));
  const remaining = new Set(nodes.map((n) => n.index));
  const running = new Map<number, Promise<void>>();

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let maxParallelism = 0;

  const settle = async (index: number, reason: string) => {
    statuses[index] = "skipped";
    skipped++;
    remaining.delete(index);
    await opts.onSkip?.(index, reason);
  };

  while (remaining.size > 0 || running.size > 0) {
    // Promote every node whose dependencies have all settled.
    let launched = false;
    for (const index of [...remaining].sort((a, b) => a - b)) {
      if (running.size >= concurrency) break;
      const node = byIndex.get(index);
      if (!node) {
        await settle(index, "no graph node");
        continue;
      }

      const unresolved = node.deps.filter((d) => statuses[d] === undefined);
      if (unresolved.length > 0) continue; // still waiting

      const blocked = node.deps.find((d) => statuses[d] !== "done");
      if (blocked !== undefined) {
        await settle(index, `dependency step ${blocked + 1} did not succeed`);
        launched = true;
        continue;
      }

      // Ready to run.
      remaining.delete(index);
      const depOutputs: Record<number, string> = {};
      for (const d of node.deps) depOutputs[d] = outputs[d] ?? "";

      const task = (async () => {
        try {
          const outcome = await runStep(index, depOutputs);
          if (outcome.status === "done") {
            outputs[index] = outcome.output;
            statuses[index] = "done";
            succeeded++;
          } else {
            statuses[index] = "failed";
            failed++;
          }
        } catch (err) {
          // runStep is expected to handle its own errors; this is the
          // backstop so a throw can never reject the scheduler loop.
          log.error("step threw outside its handler", {
            index,
            error: err instanceof Error ? err.message : String(err),
          });
          statuses[index] = "failed";
          failed++;
        } finally {
          running.delete(index);
        }
      })();

      running.set(index, task);
      maxParallelism = Math.max(maxParallelism, running.size);
      launched = true;
    }

    if (running.size > 0) {
      await Promise.race(running.values());
      continue;
    }

    if (!launched && remaining.size > 0) {
      // Nothing running, nothing became ready — the only way this
      // happens is a cycle. Fail closed rather than spin.
      for (const index of [...remaining]) {
        await settle(index, "circular dependency");
      }
      log.error("playbook graph has a cycle — remaining steps skipped");
    }
  }

  return { outputs, statuses, succeeded, failed, skipped, maxParallelism };
}
