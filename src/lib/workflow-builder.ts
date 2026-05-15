/**
 * SOVEREIGN MATRIX — Visual workflow builder data model (Cook 66 / Tier 6 #27)
 *
 * Pure DSL the drag-drop UI emits + parses. The Cook 37 orchestration
 * runtime executes; this module is the SHAPE LAYER:
 *
 *   - Typed `BuilderNode` (agent / start / branch / merge / end)
 *   - Typed `BuilderEdge` between nodes
 *   - Validate(): cycle detection, dangling-edge detection,
 *     orphan-node detection, exactly-one-start.
 *   - Compile(): emit the Cook 37 `WorkflowStep` tree from the graph.
 *
 * Pure module: no I/O, no React. Frontend renders nodes/edges from
 * this state, persists JSON to DB, and replays it by passing the
 * compiled output to runWorkflow().
 */

import {
  agent,
  branch,
  seq,
  type WorkflowStep,
  type WorkflowContext,
} from "@/lib/orchestration";

// ── Public types ──────────────────────────────────────────────────────────

export type BuilderNodeKind = "start" | "agent" | "branch" | "merge" | "end";

export interface BuilderNode {
  id: string;
  kind: BuilderNodeKind;
  /** Display label shown on the canvas. */
  label: string;
  /** Agent slug — required when kind="agent". */
  agentSlug?: string;
  /** Branch predicate expression (caller-evaluated). Required when kind="branch". */
  predicate?: string;
  /** Free-form ui hints (position, color); never executed. */
  uiHints?: Record<string, unknown>;
}

export interface BuilderEdge {
  id: string;
  from: string;
  to: string;
  /** Branch arm label — required when `from` is a branch node. */
  armLabel?: string;
}

export interface WorkflowGraph {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
}

export interface ValidationIssue {
  severity: "error" | "warn";
  code:
    | "no-start"
    | "multiple-starts"
    | "no-end"
    | "dangling-edge"
    | "cycle-detected"
    | "orphan-node"
    | "branch-missing-arm"
    | "agent-missing-slug"
    | "branch-missing-predicate";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type CompileResult =
  | { ok: true; root: WorkflowStep }
  | { ok: false; errors: ValidationIssue[] };

// ── Validation ────────────────────────────────────────────────────────────

export function validate(graph: WorkflowGraph): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  // ── Single-start, has-end ──
  const starts = graph.nodes.filter((n) => n.kind === "start");
  if (starts.length === 0) {
    errors.push({
      severity: "error",
      code: "no-start",
      message: "Workflow must have exactly one start node",
    });
  } else if (starts.length > 1) {
    errors.push({
      severity: "error",
      code: "multiple-starts",
      message: `Workflow has ${starts.length} start nodes; exactly 1 required`,
    });
  }
  if (graph.nodes.filter((n) => n.kind === "end").length === 0) {
    warnings.push({
      severity: "warn",
      code: "no-end",
      message: "Workflow has no end node — may run forever",
    });
  }

  // ── Per-node shape ──
  for (const n of graph.nodes) {
    if (n.kind === "agent" && !n.agentSlug) {
      errors.push({
        severity: "error",
        code: "agent-missing-slug",
        message: `Agent node '${n.id}' is missing agentSlug`,
        nodeId: n.id,
      });
    }
    if (n.kind === "branch" && !n.predicate) {
      errors.push({
        severity: "error",
        code: "branch-missing-predicate",
        message: `Branch node '${n.id}' is missing predicate`,
        nodeId: n.id,
      });
    }
  }

  // ── Dangling edges ──
  for (const e of graph.edges) {
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) {
      errors.push({
        severity: "error",
        code: "dangling-edge",
        message: `Edge '${e.id}' references a non-existent node`,
        edgeId: e.id,
      });
    }
    const fromNode = nodeById.get(e.from);
    if (fromNode?.kind === "branch" && !e.armLabel) {
      errors.push({
        severity: "error",
        code: "branch-missing-arm",
        message: `Edge '${e.id}' from branch node '${e.from}' needs an arm label`,
        edgeId: e.id,
      });
    }
  }

  // ── Cycle detection (DFS three-color) ──
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const colors = new Map<string, number>(graph.nodes.map((n) => [n.id, WHITE]));
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  function dfs(id: string): string | null {
    colors.set(id, GRAY);
    for (const next of adj.get(id) ?? []) {
      const c = colors.get(next);
      if (c === GRAY) return next;
      if (c === WHITE) {
        const cycle = dfs(next);
        if (cycle) return cycle;
      }
    }
    colors.set(id, BLACK);
    return null;
  }
  for (const n of graph.nodes) {
    if (colors.get(n.id) === WHITE) {
      const cycle = dfs(n.id);
      if (cycle) {
        errors.push({
          severity: "error",
          code: "cycle-detected",
          message: `Cycle detected through node '${cycle}'`,
          nodeId: cycle,
        });
        break;
      }
    }
  }

  // ── Orphan detection ──
  const reachable = new Set<string>();
  if (starts.length === 1) {
    const stack = [starts[0].id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const next of adj.get(id) ?? []) stack.push(next);
    }
    for (const n of graph.nodes) {
      if (!reachable.has(n.id) && n.kind !== "start") {
        warnings.push({
          severity: "warn",
          code: "orphan-node",
          message: `Node '${n.id}' is unreachable from start`,
          nodeId: n.id,
        });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Compilation ───────────────────────────────────────────────────────────

/**
 * Compile a validated graph to the Cook 37 `WorkflowStep` tree.
 * Linear-only for now (cycles + parallels = future cooks); branches
 * become `branch()` nodes with arm names taken from edge labels.
 */
export function compile(graph: WorkflowGraph): CompileResult {
  const validation = validate(graph);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  const start = graph.nodes.find((n) => n.kind === "start");
  if (!start) {
    return {
      ok: false,
      errors: [
        {
          severity: "error",
          code: "no-start",
          message: "no start node",
        },
      ],
    };
  }

  const adj = new Map<string, BuilderEdge[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  function stepFrom(nodeId: string, depth: number): WorkflowStep | null {
    if (depth > 64) return null; // hard recursion bound — safety against unbounded graphs
    const node = nodeById.get(nodeId);
    if (!node) return null;
    if (node.kind === "end") return null;
    if (node.kind === "agent") {
      const agentStep = agent({
        id: node.id,
        agent: node.agentSlug!,
        buildInput: (c: WorkflowContext) => c.vars,
        saveAs: node.id,
      });
      const next = adj.get(node.id)?.[0];
      if (!next) return agentStep;
      const tail = stepFrom(next.to, depth + 1);
      if (!tail) return agentStep;
      return seq(`${node.id}-seq`, [agentStep, tail]);
    }
    if (node.kind === "branch") {
      const arms: Record<string, WorkflowStep> = {};
      for (const e of adj.get(node.id) ?? []) {
        const child = stepFrom(e.to, depth + 1);
        if (child) arms[e.armLabel!] = child;
      }
      const predicateExpr = node.predicate!;
      return branch(
        node.id,
        (c: WorkflowContext) => String(c.vars[predicateExpr] ?? "default"),
        arms,
      );
    }
    // start / merge — pass through to the first outgoing edge.
    const next = adj.get(node.id)?.[0];
    if (!next) return null;
    return stepFrom(next.to, depth + 1);
  }

  const root = stepFrom(start.id, 0);
  if (!root) {
    return {
      ok: false,
      errors: [
        {
          severity: "error",
          code: "no-start",
          message: "graph compiled to no executable step",
        },
      ],
    };
  }
  return { ok: true, root };
}
