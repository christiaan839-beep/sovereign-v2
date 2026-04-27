"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { PlaybookDag } from "@/lib/playbook-dag";

/**
 * D1 PHASE 2 — React Flow drag-drop authoring canvas.
 *
 * Replaces the read-only SVG from Phase 1 with a real React Flow
 * canvas. Users can:
 *   - Drag nodes from the palette
 *   - Reposition nodes
 *   - Draw edges by connecting node handles
 *   - Delete nodes/edges with the keyboard
 *
 * The DAG shape is the same `PlaybookDag` from `src/lib/playbook-dag.ts` —
 * Phase 1's topo-sort + dry-run continue to validate without
 * modification. Phase 3 (next sprint) wires the same DAG into the
 * existing runPlaybook() execution path.
 */

interface AgentSummary {
  slug: string;
  tier: 1 | 2 | 3;
  outputClass?: string;
}

interface PlaybookCanvasProps {
  dag: PlaybookDag;
  agents: Record<string, AgentSummary>;
  onChange: (dag: PlaybookDag) => void;
  readOnly?: boolean;
}

const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: "#10b981", // emerald
  2: "#f59e0b", // amber
  3: "#f43f5e", // rose
};

function dagToReactFlow(
  dag: PlaybookDag,
  agents: Record<string, AgentSummary>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = dag.nodes.map((n) => {
    const tier = agents[n.agent]?.tier ?? 1;
    const tierColor = TIER_COLOR[tier];
    return {
      id: n.id,
      position: n.position,
      data: { label: `${n.id}\n${n.agent}` },
      type: "default",
      style: {
        background: `${tierColor}1a`,
        border: `2px solid ${tierColor}`,
        borderRadius: 8,
        color: "#e5e7eb",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        padding: "8px 12px",
        width: 160,
        whiteSpace: "pre-wrap" as const,
        textAlign: "left" as const,
      },
    };
  });

  const edges: Edge[] = dag.edges.map((e, i) => {
    const [fromNode, fromField] = e.from.split(".");
    const [toNode, toField] = e.to.split(".");
    return {
      id: `e${i}-${e.from}-${e.to}`,
      source: fromNode,
      target: toNode,
      label: fromField && toField ? `${fromField} → ${toField}` : undefined,
      style: { stroke: "rgba(255,255,255,0.4)", strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: "rgba(255,255,255,0.5)" },
      labelBgStyle: { fill: "transparent" },
    };
  });

  return { nodes, edges };
}

function reactFlowToDag(
  nodes: Node[],
  edges: Edge[],
  prevDag: PlaybookDag,
): PlaybookDag {
  const prevById = new Map(prevDag.nodes.map((n) => [n.id, n]));
  return {
    nodes: nodes.map((n) => {
      const prev = prevById.get(n.id);
      return {
        id: n.id,
        agent: prev?.agent ?? "leads",
        position: n.position,
        config: prev?.config ?? {},
      };
    }),
    edges: edges.map((e) => ({
      from: `${e.source}.out`,
      to: `${e.target}.in`,
    })),
  };
}

export function PlaybookCanvas({ dag, agents, onChange, readOnly = false }: PlaybookCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => dagToReactFlow(dag, agents),
    [dag, agents],
  );

  // React Flow's internal state is the source of truth during drag.
  // We sync back to the DAG via onChange after each change so the
  // dry-run panel updates live.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      const next = applyNodeChanges(changes, initialNodes);
      onChange(reactFlowToDag(next, initialEdges, dag));
    },
    [initialNodes, initialEdges, dag, onChange, readOnly],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      const next = applyEdgeChanges(changes, initialEdges);
      onChange(reactFlowToDag(initialNodes, next, dag));
    },
    [initialNodes, initialEdges, dag, onChange, readOnly],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (readOnly) return;
      const next = addEdge(conn, initialEdges);
      onChange(reactFlowToDag(initialNodes, next, dag));
    },
    [initialNodes, initialEdges, dag, onChange, readOnly],
  );

  return (
    <div className="h-[480px] w-full rounded-xl border border-white/10 bg-[#0a0a0a]">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesFocusable={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.04)" gap={20} />
        <Controls
          className="[&>button]:!bg-white/5 [&>button]:!border-white/10 [&>button]:!text-neutral-300"
        />
        <MiniMap
          nodeColor={(n) => {
            const slug = (n.data?.label as string)?.split("\n")[1] ?? "";
            const tier = agents[slug]?.tier ?? 1;
            return TIER_COLOR[tier];
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </ReactFlow>
    </div>
  );
}
