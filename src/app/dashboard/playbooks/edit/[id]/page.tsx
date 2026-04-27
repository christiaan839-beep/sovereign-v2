"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { topoSort, dryRun, type PlaybookDag } from "@/lib/playbook-dag";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { NodePalette } from "@/components/playbook/NodePalette";

/**
 * D1 PHASE 2 — drag-drop visual playbook editor.
 *
 * Replaces Phase 1's read-only SVG with a React Flow canvas that
 * supports:
 *   - Drag a node to reposition
 *   - Click an agent in the palette → adds at a default position
 *   - Connect nodes by drawing edges between handles
 *   - Live dry-run validation (cycle detection, missing fields)
 *   - Save → POST /api/playbooks/dag (Phase 3 wires execution)
 */

interface AgentSummary {
  slug: string;
  tier: 1 | 2 | 3;
  outputClass?: string;
}

const STARTER_DAG: PlaybookDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 80, y: 100 }, config: { count: 10 } },
    { id: "n2", agent: "outreach-personalizer", position: { x: 380, y: 100 }, config: {} },
  ],
  edges: [{ from: "n1.leads", to: "n2.target" }],
};

export default function PlaybookEditorPage() {
  const [dag, setDag] = useState<PlaybookDag>(STARTER_DAG);
  const [agents, setAgents] = useState<Record<string, AgentSummary>>({});
  const [requiredBySlug, setRequiredBySlug] = useState<Record<string, string[]>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let alive = true;
    fetch("/api/_meta/agents.json")
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        const map: Record<string, AgentSummary> = {};
        for (const [slug, m] of Object.entries(
          (body as { agents?: Record<string, { tier: 1 | 2 | 3; outputClass?: string }> }).agents ?? {},
        )) {
          map[slug] = { slug, tier: m.tier, outputClass: m.outputClass };
        }
        setAgents(map);
        setRequiredBySlug({
          leads: ["count"],
          "outreach-personalizer": ["target", "template"],
          "email-sequence": ["audience", "touches"],
          "abm-artillery": ["company", "industry"],
          consensus: ["prompt"],
          "blog-gen": ["topic"],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const result = useMemo(() => dryRun(dag, requiredBySlug), [dag, requiredBySlug]);
  const order = useMemo(() => topoSort(dag).order, [dag]);

  const handleAddNode = useCallback((slug: string) => {
    setDag((d) => {
      const maxX = d.nodes.reduce((acc, n) => Math.max(acc, n.position.x), 0);
      const newId = `n${d.nodes.length + 1}_${slug.slice(0, 6)}`;
      return {
        nodes: [
          ...d.nodes,
          {
            id: newId,
            agent: slug,
            position: { x: maxX + 220, y: 100 + (d.nodes.length % 3) * 100 },
            config: {},
          },
        ],
        edges: d.edges,
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/playbooks/dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) {
        setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch {
      setSaveState("error");
    }
  }, [dag]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-neutral-200">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/dashboard/playbooks" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← Playbooks
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Playbook editor</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Drag agents from the palette. Click to add. Connect handles to wire data flow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-xs rounded border px-2.5 py-1 ${
              result.valid
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {result.valid
              ? "✓ DAG valid"
              : `${result.missingFields.length} issue${result.missingFields.length === 1 ? "" : "s"}`}
          </div>
          <button
            onClick={handleSave}
            disabled={!result.valid || saveState === "saving"}
            className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved ✓"
                : saveState === "error"
                  ? "Retry"
                  : "Save"}
          </button>
        </div>
      </header>

      <div className="flex gap-4">
        <NodePalette agents={agents} onAddNode={handleAddNode} />
        <div className="flex-1">
          <PlaybookCanvas dag={dag} agents={agents} onChange={setDag} />
        </div>
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
                    <span className="text-xs text-neutral-500">→ {node?.agent}</span>
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
