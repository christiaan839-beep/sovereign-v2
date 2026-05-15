"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  validate,
  compile,
  type BuilderEdge,
  type BuilderNode,
  type BuilderNodeKind,
  type WorkflowGraph,
} from "@/lib/workflow-builder";

/**
 * /builder — Visual workflow builder (Cook 71).
 *
 * Tabular DSL editor on top of the Cook 66 data model. Drag-drop
 * canvas is the future enhancement; this surface is already 100% of
 * the way to a runnable workflow because validate() + compile() are
 * the source of truth.
 *
 * Live validation: every edit re-runs `validate()` and surfaces
 * errors + warnings inline.
 */

const NODE_KINDS: BuilderNodeKind[] = [
  "start",
  "agent",
  "branch",
  "merge",
  "end",
];

const SEED_GRAPH: WorkflowGraph = {
  nodes: [
    { id: "n-start", kind: "start", label: "Start" },
    {
      id: "n-qualify",
      kind: "agent",
      label: "Qualify lead",
      agentSlug: "lead-qualifier",
    },
    {
      id: "n-route",
      kind: "branch",
      label: "Tier?",
      predicate: "tier",
    },
    {
      id: "n-hot",
      kind: "agent",
      label: "Tier 1 support",
      agentSlug: "tier1-support",
    },
    {
      id: "n-warm",
      kind: "agent",
      label: "Sourcing sprint",
      agentSlug: "sourcing-sprint",
    },
    { id: "n-end", kind: "end", label: "End" },
  ],
  edges: [
    { id: "e1", from: "n-start", to: "n-qualify" },
    { id: "e2", from: "n-qualify", to: "n-route" },
    { id: "e3", from: "n-route", to: "n-hot", armLabel: "hot" },
    { id: "e4", from: "n-route", to: "n-warm", armLabel: "warm" },
    { id: "e5", from: "n-hot", to: "n-end" },
    { id: "e6", from: "n-warm", to: "n-end" },
  ],
};

let nodeCounter = 100;
let edgeCounter = 100;
function newNodeId() {
  return `n-${nodeCounter++}`;
}
function newEdgeId() {
  return `e-${edgeCounter++}`;
}

export default function BuilderPage() {
  const [graph, setGraph] = useState<WorkflowGraph>(SEED_GRAPH);

  const validation = useMemo(() => validate(graph), [graph]);
  const compiled = useMemo(() => {
    if (!validation.ok) return null;
    const c = compile(graph);
    return c.ok ? c.root : null;
  }, [graph, validation.ok]);

  function setNode(id: string, patch: Partial<BuilderNode>) {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }
  function setEdge(id: string, patch: Partial<BuilderEdge>) {
    setGraph((g) => ({
      ...g,
      edges: g.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }
  function addNode() {
    const id = newNodeId();
    setGraph((g) => ({
      ...g,
      nodes: [
        ...g.nodes,
        { id, kind: "agent", label: "New step", agentSlug: "" },
      ],
    }));
  }
  function addEdge() {
    const id = newEdgeId();
    setGraph((g) => ({
      ...g,
      edges: [
        ...g.edges,
        { id, from: g.nodes[0]?.id ?? "", to: g.nodes[1]?.id ?? "" },
      ],
    }));
  }
  function removeNode(id: string) {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.from !== id && e.to !== id),
    }));
  }
  function removeEdge(id: string) {
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
  }

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <span className="text-sm font-bold text-white">Workflow Builder</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <header>
          <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4">
            Visual Workflow Builder
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
            Compose the 145 agents into one workflow.
          </h1>
          <p className="text-sm text-neutral-400 max-w-2xl">
            Every change re-validates against the Cook 66 rules (cycle
            detection, dangling edges, branch arm shape). When the graph is
            clean, it compiles to a Cook 37 WorkflowStep tree runnable through{" "}
            <code className="text-neutral-300">runWorkflow()</code>.
          </p>
        </header>

        {/* Validation */}
        <section
          className={`p-4 rounded-2xl border ${
            validation.ok
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-rose-500/30 bg-rose-500/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {validation.ok ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <h2 className="text-sm font-semibold text-white">
              {validation.ok ? "Graph is valid" : "Graph has errors"}
            </h2>
          </div>
          {validation.errors.length > 0 && (
            <ul className="space-y-1">
              {validation.errors.map((e, i) => (
                <li key={i} className="text-xs text-rose-300">
                  [{e.code}] {e.message}
                </li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="space-y-1 mt-2">
              {validation.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300">
                  [{w.code}] {w.message}
                </li>
              ))}
            </ul>
          )}
          {compiled && (
            <p className="text-[11px] text-emerald-300 mt-2">
              Compiled root kind: <code>{compiled.kind}</code>
            </p>
          )}
        </section>

        {/* Nodes table */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Nodes</h2>
            <button
              onClick={addNode}
              className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300 hover:bg-white/[0.08]"
            >
              <Plus className="w-3.5 h-3.5" /> Add node
            </button>
          </header>
          <div className="space-y-2">
            {graph.nodes.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-2"
              >
                <code className="text-[10px] text-neutral-500 w-24 shrink-0">
                  {n.id}
                </code>
                <select
                  value={n.kind}
                  onChange={(e) =>
                    setNode(n.id, {
                      kind: e.target.value as BuilderNodeKind,
                    })
                  }
                  className="text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white"
                >
                  {NODE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  value={n.label}
                  onChange={(e) => setNode(n.id, { label: e.target.value })}
                  placeholder="Label"
                  className="flex-1 min-w-[140px] text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white"
                />
                {n.kind === "agent" && (
                  <input
                    value={n.agentSlug ?? ""}
                    onChange={(e) =>
                      setNode(n.id, { agentSlug: e.target.value })
                    }
                    placeholder="agent-slug"
                    className="w-44 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                  />
                )}
                {n.kind === "branch" && (
                  <input
                    value={n.predicate ?? ""}
                    onChange={(e) =>
                      setNode(n.id, { predicate: e.target.value })
                    }
                    placeholder="vars key"
                    className="w-44 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white font-mono"
                  />
                )}
                <button
                  onClick={() => removeNode(n.id)}
                  className="text-rose-400 hover:text-rose-300 p-1"
                  aria-label="Remove node"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Edges table */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Edges</h2>
            <button
              onClick={addEdge}
              className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300 hover:bg-white/[0.08]"
            >
              <Plus className="w-3.5 h-3.5" /> Add edge
            </button>
          </header>
          <div className="space-y-2">
            {graph.edges.map((e) => {
              const fromNode = graph.nodes.find((n) => n.id === e.from);
              return (
                <div
                  key={e.id}
                  className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-2"
                >
                  <code className="text-[10px] text-neutral-500 w-24 shrink-0">
                    {e.id}
                  </code>
                  <select
                    value={e.from}
                    onChange={(ev) => setEdge(e.id, { from: ev.target.value })}
                    className="text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white"
                  >
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                  <span className="text-neutral-500 text-xs">→</span>
                  <select
                    value={e.to}
                    onChange={(ev) => setEdge(e.id, { to: ev.target.value })}
                    className="text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white"
                  >
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                  {fromNode?.kind === "branch" && (
                    <input
                      value={e.armLabel ?? ""}
                      onChange={(ev) =>
                        setEdge(e.id, { armLabel: ev.target.value })
                      }
                      placeholder="arm label"
                      className="w-32 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white"
                    />
                  )}
                  <button
                    onClick={() => removeEdge(e.id)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                    aria-label="Remove edge"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-2">
            JSON (copy + persist to your tenant)
          </h2>
          <pre className="text-[10px] leading-relaxed p-4 rounded-2xl bg-black/40 border border-white/[0.05] text-neutral-300 overflow-auto max-h-72">
            {JSON.stringify(graph, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}
