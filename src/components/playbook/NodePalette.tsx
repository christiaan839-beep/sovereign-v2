"use client";

import { useMemo, useState } from "react";

interface AgentSummary {
  slug: string;
  tier: 1 | 2 | 3;
  outputClass?: string;
}

interface NodePaletteProps {
  agents: Record<string, AgentSummary>;
  onAddNode: (slug: string) => void;
  /** Tenant policy filter — if set, hide agents the policy denies. */
  policyDenied?: Set<string>;
}

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
};

const TIER_BADGE_CLASSES: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  2: "bg-amber-500/10 text-amber-200 border-amber-500/30",
  3: "bg-rose-500/10 text-rose-200 border-rose-500/30",
};

/**
 * Sidebar palette of agents, filterable + searchable. Click adds the
 * agent as a new node at a default position; the canvas's `onNodesChange`
 * picks up the addition.
 *
 * Per-row tier badge gives immediate UX feedback: T3 agents look
 * "weighty" so users self-throttle adding them carelessly.
 */
export function NodePalette({ agents, onAddNode, policyDenied }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<1 | 2 | 3 | null>(null);

  const sorted = useMemo(() => {
    const list = Object.values(agents);
    list.sort((a, b) => a.slug.localeCompare(b.slug));
    return list;
  }, [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((a) => {
      if (tierFilter !== null && a.tier !== tierFilter) return false;
      if (policyDenied?.has(a.slug)) return false;
      if (!q) return true;
      return a.slug.toLowerCase().includes(q);
    });
  }, [sorted, query, tierFilter, policyDenied]);

  return (
    <aside className="flex h-[480px] w-64 flex-col rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 p-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${sorted.length} agents…`}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
        />
        <div className="mt-2 flex gap-1.5 text-[10px]">
          {([null, 1, 2, 3] as const).map((t) => (
            <button
              key={t ?? "all"}
              onClick={() => setTierFilter(t)}
              className={`rounded border px-2 py-0.5 transition ${
                tierFilter === t
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-neutral-400 hover:bg-white/5"
              }`}
            >
              {t == null ? "all" : TIER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500">
            No agents match
          </div>
        ) : (
          filtered.map((a) => (
            <button
              key={a.slug}
              onClick={() => onAddNode(a.slug)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/[0.04]"
            >
              <span
                className={`flex-shrink-0 rounded border px-1.5 py-0 text-[9px] font-mono ${TIER_BADGE_CLASSES[a.tier]}`}
              >
                {TIER_LABEL[a.tier]}
              </span>
              <span className="font-mono text-neutral-300 group-hover:text-neutral-100 truncate">
                {a.slug}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-3 text-[10px] text-neutral-500">
        Click to add. Drag to reposition.
      </div>
    </aside>
  );
}
