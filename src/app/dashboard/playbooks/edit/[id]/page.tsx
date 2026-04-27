"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { topoSort, dryRun, type PlaybookDag } from "@/lib/playbook-dag";

/**
 * D1 PHASE 1 — read-only visual playbook editor.
 *
 * Renders a playbook DAG as plain SVG (no React Flow yet — adds 80KB
 * of deps for an MVP). Customers see:
 *   - Agent nodes positioned by `position.{x,y}`
 *   - Connecting edges from output → input
 *   - Per-node tier badge + capability hints
 *   - Live dry-run validation: missing fields + cycles surfaced
 *
 * Phase 2 (next session): React Flow + drag/drop authoring + persist.
 * Phase 3: live execution streaming.
 *
 * Today this is intentionally read-only — the canvas is for inspecting
 * and validating an existing playbook DAG. The DAG shape comes from
 * `src/lib/playbook-dag.ts` and is the same shape Phase 2 will write
 * to the playbooks.dag column.
 */

interface AgentSummary {
  slug: string;
  tier: 1 | 2 | 3;
}

// Demo DAG used until the playbooks API surfaces the dag column.
// Replace with `fetch(/api/playbooks/<id>)` once Phase 2 lands.
const DEMO_DAG: PlaybookDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 60, y: 80 }, config: { count: 10 } },
    {
      id: "n2",
      agent: "outreach-personalizer",
      position: { x: 360, y: 40 },
      config: {},
    },
    {
      id: "n3",
      agent: "email-sequence",
      position: { x: 360, y: 160 },
      config: {},
    },
    { id: "n4", agent: "abm-artillery", position: { x: 660, y: 100 }, config: {} },
  ],
  edges: [
    { from: "n1.leads", to: "n2.target" },
    { from: "n1.leads", to: "n3.audience" },
    { from: "n2.message", to: "n4.opener" },
    { from: "n3.firstEmail", to: "n4.followup" },
  ],
};

export default function PlaybookEditorPage() {
  const [agents, setAgents] = useState<Record<string, AgentSummary>>({});
  const [requiredBySlug, setRequiredBySlug] = useState<Record<string, string[]>>({});
  const [dag] = useState<PlaybookDag>(DEMO_DAG);

  // Pull tier info + required fields from /api/_meta/agents.json so
  // node badges + dry-run match production manifests.
  useEffect(() => {
    let alive = true;
    fetch("/api/_meta/agents.json")
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        const map: Record<string, AgentSummary> = {};
        for (const [slug, m] of Object.entries(
          (body as { agents?: Record<string, { tier: 1 | 2 | 3 }> }).agents ?? {},
        )) {
          map[slug] = { slug, tier: m.tier };
        }
        setAgents(map);
        // requiredFields aren't in agents.json yet (next-session
        // schema bump). For now we hard-code a few common ones so
        // dry-run finds something to flag.
        setRequiredBySlug({
          leads: ["count"],
          "outreach-personalizer": ["target", "template"],
          "email-sequence": ["audience", "touches"],
          "abm-artillery": ["company", "industry"],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const result = useMemo(() => dryRun(dag, requiredBySlug), [dag, requiredBySlug]);
  const order = useMemo(() => topoSort(dag).order, [dag]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-neutral-200">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/dashboard/playbooks" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← Playbooks
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Playbook editor (preview)</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Read-only canvas. Drag-drop authoring lands in the next sprint
            (see{" "}
            <Link
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/claude/wizardly-benz/docs/VISUAL-PLAYBOOK-EDITOR-DESIGN.md"
              className="underline hover:text-neutral-200"
            >
              VISUAL-PLAYBOOK-EDITOR-DESIGN.md
            </Link>
            ).
          </p>
        </div>
        <div
          className={`text-xs rounded border px-2.5 py-1 ${
            result.valid
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {result.valid ? "✓ DAG valid" : `${result.missingFields.length} issue${result.missingFields.length === 1 ? "" : "s"}`}
        </div>
      </header>

      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-2">
        <Canvas dag={dag} agents={agents} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Execution order (topological)
          </div>
          <ol className="mt-3 space-y-1 text-sm text-neutral-300">
            {order ? (
              order.map((id, i) => {
                const node = dag.nodes.find((n) => n.id === id);
                return (
                  <li key={id} className="flex items-baseline gap-3">
                    <span className="text-xs text-neutral-500 font-mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-xs text-neutral-200">{id}</span>
                    <span className="text-xs text-neutral-500">
                      → {node?.agent}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="text-rose-400">Cycle detected — DAG cannot execute</li>
            )}
          </ol>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Pre-flight checks
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-baseline gap-2">
              <span
                className={`text-xs font-mono ${
                  result.cycle == null ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {result.cycle == null ? "✓" : "✗"}
              </span>
              <span className="text-neutral-300">
                {result.cycle == null
                  ? "Acyclic — execution order computed"
                  : `Cycle: ${result.cycle.join(" → ")}`}
              </span>
            </li>
            {result.missingFields.length === 0 ? (
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-400 text-xs font-mono">✓</span>
                <span className="text-neutral-300">All required fields wired</span>
              </li>
            ) : (
              result.missingFields.map((m, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-amber-400 text-xs font-mono">!</span>
                  <span className="text-neutral-300">
                    Node{" "}
                    <code className="text-xs text-amber-200">{m.nodeId}</code>{" "}
                    missing field{" "}
                    <code className="text-xs text-amber-200">{m.field}</code>
                  </span>
                </li>
              ))
            )}
            <li className="pt-2 border-t border-white/5 flex items-baseline gap-2">
              <span className="text-neutral-500 text-xs">est.</span>
              <span className="text-neutral-300">
                ~{result.estimatedKtokens} Ktokens / run
              </span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Canvas({
  dag,
  agents,
}: {
  dag: PlaybookDag;
  agents: Record<string, AgentSummary>;
}) {
  // Bound the SVG so it captures all nodes + a bit of padding.
  const W = 900;
  const H = 320;

  const tierColor = (slug: string) => {
    const tier = agents[slug]?.tier ?? 1;
    return tier === 3
      ? "stroke-rose-400 fill-rose-500/10"
      : tier === 2
        ? "stroke-amber-400 fill-amber-500/10"
        : "stroke-emerald-400 fill-emerald-500/10";
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[320px] [&_text]:select-none"
    >
      {/* Subtle grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        </pattern>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6" fill="rgba(255,255,255,0.4)" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Edges */}
      {dag.edges.map((e, i) => {
        const fromNode = dag.nodes.find((n) => n.id === e.from.split(".")[0]);
        const toNode = dag.nodes.find((n) => n.id === e.to.split(".")[0]);
        if (!fromNode || !toNode) return null;
        const x1 = fromNode.position.x + 140;
        const y1 = fromNode.position.y + 30;
        const x2 = toNode.position.x;
        const y2 = toNode.position.y + 30;
        const cx1 = x1 + Math.abs(x2 - x1) * 0.4;
        const cx2 = x2 - Math.abs(x2 - x1) * 0.4;
        return (
          <path
            key={i}
            d={`M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1.5"
            fill="none"
            markerEnd="url(#arrow)"
          />
        );
      })}

      {/* Nodes */}
      {dag.nodes.map((n) => (
        <g
          key={n.id}
          transform={`translate(${n.position.x}, ${n.position.y})`}
        >
          <rect
            width="140"
            height="60"
            rx="8"
            className={tierColor(n.agent)}
            strokeWidth="1.5"
          />
          <text
            x="10"
            y="22"
            className="fill-neutral-200 text-[11px] font-mono"
          >
            {n.id}
          </text>
          <text
            x="10"
            y="40"
            className="fill-neutral-300 text-[11px]"
          >
            {n.agent.length > 18 ? `${n.agent.slice(0, 16)}…` : n.agent}
          </text>
          <text
            x="10"
            y="54"
            className="fill-neutral-500 text-[9px]"
          >
            T{agents[n.agent]?.tier ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
}
