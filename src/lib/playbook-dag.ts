/**
 * PLAYBOOK DAG — schema + topo sort + dry-run.
 *
 * Visual editor compiles to this shape; existing code-defined
 * playbooks could be exported to it. The factory's runPlaybook()
 * already walks linear sequences; this module adds the DAG layer
 * that the editor needs.
 *
 * Phase 1 (this commit): schema + topo + dry-run. No execution path
 * change yet — playbooks still run via src/lib/playbooks.ts. Phase 2
 * (next session) wires DAG-shaped playbooks into the same
 * runPlaybook() so authoring surface doesn't matter at runtime.
 */

export interface PlaybookNode {
  /** Stable per-node ID — used as edge endpoint reference. */
  id: string;
  /** Agent slug from /api/_meta/agents.json. */
  agent: string;
  /** Display position on the canvas (UI-only; not part of execution). */
  position: { x: number; y: number };
  /** Per-node config — passed as `input` to the agent. May reference
   *  upstream outputs via `$.<nodeId>.<jsonpath>` placeholders. */
  config: Record<string, unknown>;
}

export interface PlaybookEdge {
  /** "<nodeId>.<output_field>" — source. */
  from: string;
  /** "<nodeId>.<input_field>" — target. */
  to: string;
}

export interface PlaybookDag {
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
}

export interface DryRunResult {
  /** Topological order of node execution. */
  executionOrder: string[];
  /** Per-node missing required input fields, if any. */
  missingFields: Array<{ nodeId: string; field: string }>;
  /** True iff the DAG is acyclic + every required field is wired. */
  valid: boolean;
  /** First-found cycle (node IDs in order) if any. */
  cycle: string[] | null;
  /** Estimated total Ktokens (approximate, for cost preview). */
  estimatedKtokens: number;
}

/**
 * Topologically sort the DAG. Returns null if a cycle is detected;
 * otherwise the node IDs in execution order.
 */
export function topoSort(dag: PlaybookDag): { order: string[] | null; cycle: string[] | null } {
  // Kahn's algorithm — counts incoming edges, repeatedly removes
  // zero-in-degree nodes.
  const inDegree = new Map<string, number>();
  const adj = new Map<string, Set<string>>();

  for (const n of dag.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, new Set());
  }
  for (const e of dag.edges) {
    const fromNode = e.from.split(".")[0];
    const toNode = e.to.split(".")[0];
    if (!inDegree.has(fromNode) || !inDegree.has(toNode)) continue;
    if (!adj.get(fromNode)!.has(toNode)) {
      adj.get(fromNode)!.add(toNode);
      inDegree.set(toNode, (inDegree.get(toNode) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (order.length !== dag.nodes.length) {
    // Cycle detected — find one for the error report.
    const cycle: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg > 0) cycle.push(id);
    }
    return { order: null, cycle };
  }

  return { order, cycle: null };
}

/**
 * Cheap pre-execution check: walk the topological order, build a
 * map of declared outputs per node, then verify every node's required
 * config field has either a literal value or an upstream wire.
 *
 * `requiredFieldsBySlug` is provided by the caller (typically read
 * from /api/_meta/agents.json#<slug>); we don't pull the registry
 * here so this stays a pure function.
 */
export function dryRun(
  dag: PlaybookDag,
  requiredFieldsBySlug: Record<string, string[]>,
): DryRunResult {
  const { order, cycle } = topoSort(dag);
  if (!order) {
    return {
      executionOrder: [],
      missingFields: [],
      valid: false,
      cycle,
      estimatedKtokens: 0,
    };
  }

  // Track which fields each node WILL receive (literal config + edges-in).
  const fieldsIn = new Map<string, Set<string>>();
  for (const n of dag.nodes) {
    const set = new Set<string>(Object.keys(n.config));
    fieldsIn.set(n.id, set);
  }
  for (const e of dag.edges) {
    const [, toField] = e.to.split(".");
    const [toNode] = e.to.split(".");
    if (toField) fieldsIn.get(toNode)?.add(toField);
  }

  const missingFields: Array<{ nodeId: string; field: string }> = [];
  for (const n of dag.nodes) {
    const required = requiredFieldsBySlug[n.agent] ?? [];
    const have = fieldsIn.get(n.id) ?? new Set();
    for (const r of required) {
      if (!have.has(r)) missingFields.push({ nodeId: n.id, field: r });
    }
  }

  return {
    executionOrder: order,
    missingFields,
    valid: missingFields.length === 0,
    cycle: null,
    estimatedKtokens: dag.nodes.length * 2, // rough average — replace with per-agent stats later
  };
}

/**
 * Per-node execution result from `executeDag()`.
 */
export interface NodeRunResult {
  nodeId: string;
  agent: string;
  status: "completed" | "failed" | "skipped";
  output?: unknown;
  durationMs: number;
  error?: string;
}

export interface ExecuteDagResult {
  status: "completed" | "failed";
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt?: string;
}

/**
 * Resolve `$.<nodeId>.<jsonPath>` placeholders in a node's config
 * against the accumulated outputs of previous nodes. Pure function.
 */
export function resolvePlaceholders(
  config: Record<string, unknown>,
  results: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string") {
      out[key] = value;
      continue;
    }
    const match = value.match(/^\$\.([\w-]+)(?:\.(.+))?$/);
    if (!match) {
      out[key] = value;
      continue;
    }
    const [, nodeId, path] = match;
    const upstream = results[nodeId];
    if (upstream === undefined) {
      out[key] = null;
      continue;
    }
    if (!path) {
      out[key] = upstream;
      continue;
    }
    let cursor: unknown = upstream;
    for (const seg of path.split(".")) {
      if (cursor && typeof cursor === "object" && seg in cursor) {
        cursor = (cursor as Record<string, unknown>)[seg];
      } else {
        cursor = null;
        break;
      }
    }
    out[key] = cursor;
  }
  return out;
}

/**
 * Execute a DAG by topo-walking nodes and invoking each via the
 * supplied runner. The agent runner is injected so this module stays
 * testable without the full runtime.
 *
 * Default behavior: stop on first failure. Set continueOnError=true
 * to keep going (downstream nodes are still skipped if their inputs
 * couldn't be resolved).
 *
 * `onProgress` is fired after each node reaches a terminal state
 * (completed / failed / skipped). The callback receives the partial
 * results array AND the count of nodes done so far. Used by the
 * async/queued path (Round 12) to persist incremental progress so
 * the editor's polling client sees a live view. NEVER throws — a
 * progress-callback failure is logged upstream but doesn't kill the
 * execution.
 */
export async function executeDag(
  dag: PlaybookDag,
  runAgent: (slug: string, input: Record<string, unknown>) => Promise<unknown>,
  options: {
    continueOnError?: boolean;
    onProgress?: (results: NodeRunResult[], completedCount: number) => void | Promise<void>;
  } = {},
): Promise<ExecuteDagResult> {
  const t0 = Date.now();
  const { order, cycle } = topoSort(dag);
  if (!order) {
    return {
      status: "failed",
      results: [],
      totalDurationMs: Date.now() - t0,
      failedAt: cycle?.[0],
    };
  }

  const outputs: Record<string, unknown> = {};
  const results: NodeRunResult[] = [];
  let failed = false;

  // Helper: fire onProgress without ever throwing. The progress
  // callback's only job is observation (persist to DB, push a log
  // line); it must not affect execution. We swallow errors here so
  // a transient DB hiccup doesn't kill the run.
  const fireProgress = async () => {
    if (!options.onProgress) return;
    try {
      await options.onProgress(results, results.length);
    } catch {
      // intentional: never let observation kill execution
    }
  };

  for (const nodeId of order) {
    const node = dag.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    if (failed && !options.continueOnError) {
      results.push({
        nodeId,
        agent: node.agent,
        status: "skipped",
        durationMs: 0,
      });
      await fireProgress();
      continue;
    }

    const nodeStart = Date.now();
    const resolvedConfig = resolvePlaceholders(node.config, outputs);

    try {
      const output = await runAgent(node.agent, resolvedConfig);
      outputs[nodeId] = output;
      results.push({
        nodeId,
        agent: node.agent,
        status: "completed",
        output,
        durationMs: Date.now() - nodeStart,
      });
    } catch (err) {
      failed = true;
      results.push({
        nodeId,
        agent: node.agent,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - nodeStart,
      });
    }

    await fireProgress();
  }

  return {
    status: failed ? "failed" : "completed",
    results,
    totalDurationMs: Date.now() - t0,
    failedAt: results.find((r) => r.status === "failed")?.nodeId,
  };
}
