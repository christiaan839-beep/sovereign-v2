/**
 * SOVEREIGN MATRIX — Output provenance graph (Cook 92).
 *
 * Every agent output carries an HMAC-signed receipt; this module
 * adds a structured PROVENANCE GRAPH on top so a regulator can ask
 * "which source documents + which model + which agent version
 * produced this claim?" and get a typed answer.
 *
 * Pure module — no I/O. Caller builds the graph during agent
 * execution and embeds the result verbatim in the receipt.
 *
 * Node types:
 *   - input       (original user / API payload)
 *   - source      (RAG-retrieved memory / document / URL)
 *   - tool-call   (one Cook 36 tool invocation)
 *   - model-call  (one ai() call with model + tokens)
 *   - claim       (an answer sentence — references the nodes that
 *                  supported it; emitted by Cook 41 hallucination
 *                  detector)
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type ProvenanceNodeKind =
  | "input"
  | "source"
  | "tool-call"
  | "model-call"
  | "claim";

export interface ProvenanceNode {
  id: string;
  kind: ProvenanceNodeKind;
  /** Stable label shown in the receipt audit UI. */
  label: string;
  /** Free-form metadata — JSON-serializable. */
  meta?: Record<string, unknown>;
}

export interface ProvenanceEdge {
  from: string;
  to: string;
  /** Optional relation label ("cites", "derives-from", "invoked"). */
  rel?: string;
}

export interface ProvenanceGraph {
  /** Stable fingerprint of the graph — embeds in receipts. */
  hash: string;
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

// ── Builder ───────────────────────────────────────────────────────────────

export class ProvenanceBuilder {
  private readonly nodes: ProvenanceNode[] = [];
  private readonly edges: ProvenanceEdge[] = [];
  private readonly ids = new Set<string>();

  add(node: ProvenanceNode): this {
    if (this.ids.has(node.id)) {
      throw new Error(`ProvenanceBuilder: duplicate node id '${node.id}'`);
    }
    this.ids.add(node.id);
    this.nodes.push(node);
    return this;
  }

  link(from: string, to: string, rel?: string): this {
    if (!this.ids.has(from)) {
      throw new Error(`ProvenanceBuilder: edge.from '${from}' unknown`);
    }
    if (!this.ids.has(to)) {
      throw new Error(`ProvenanceBuilder: edge.to '${to}' unknown`);
    }
    this.edges.push({ from, to, ...(rel ? { rel } : {}) });
    return this;
  }

  build(): ProvenanceGraph {
    // Canonical ordering: nodes sorted by id, edges sorted lexicographically.
    const sortedNodes = [...this.nodes].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const sortedEdges = [...this.edges].sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.to !== b.to) return a.to.localeCompare(b.to);
      return (a.rel ?? "").localeCompare(b.rel ?? "");
    });
    // Stable hash for embedding in receipts.
    const canonical = JSON.stringify({
      nodes: sortedNodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        label: n.label,
        ...(n.meta ? { meta: stableSort(n.meta) } : {}),
      })),
      edges: sortedEdges,
    });
    const hash = createHash("sha256").update(canonical).digest("hex");
    return { hash, nodes: sortedNodes, edges: sortedEdges };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stableSort(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    const v = o[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? stableSort(v as Record<string, unknown>)
        : v;
  }
  return out;
}

/**
 * Walk every node a `claim` ultimately derives from. Returns the
 * dependency set in a stable order. Useful for citation rendering +
 * proving "this answer depended on these sources".
 */
export function rootAncestorsOf(
  graph: ProvenanceGraph,
  claimId: string,
): ProvenanceNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push(e.from);
  }
  const seen = new Set<string>();
  const out: ProvenanceNode[] = [];
  const stack = [claimId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    if (id !== claimId && (node.kind === "input" || node.kind === "source")) {
      out.push(node);
    }
    for (const from of incoming.get(id) ?? []) stack.push(from);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
