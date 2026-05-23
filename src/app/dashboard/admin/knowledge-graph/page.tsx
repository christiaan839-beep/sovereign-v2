"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/knowledge-graph (Wave 148).
 *
 * Operator-facing view into the entity-relationship layer built
 * incrementally by `recordRunAsGraph` in agent-factory. Lets the
 * operator inspect the platform's accumulated knowledge per user.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Network,
  RefreshCw,
  Search as SearchIcon,
} from "lucide-react";
import { motion } from "framer-motion";

interface GraphNode {
  id: string;
  nodeType: string;
  label: string;
  confidence: number;
  degree: number;
}

interface GraphSummary {
  userId: string;
  nodeCounts: Array<{ type: string; count: number }>;
  topNodes: GraphNode[];
  edgeCount: number;
}

const NODE_TYPE_COLOR: Record<string, string> = {
  agent: "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300",
  domain: "border-violet-500/30 bg-violet-500/[0.08] text-violet-300",
  url: "border-violet-500/30 bg-violet-500/[0.08] text-violet-300",
  amount: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
  date: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
  entity: "border-rose-500/30 bg-rose-500/[0.08] text-rose-300",
  concept: "border-neutral-500/30 bg-neutral-500/[0.08] text-neutral-300",
};

function nodeStyle(type: string): string {
  return NODE_TYPE_COLOR[type] ?? NODE_TYPE_COLOR.concept;
}

export default function AdminKnowledgeGraphPage() {
  const [userInput, setUserInput] = useState("");
  const [data, setData] = useState<GraphSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async (userId: string) => {
    if (!userId.trim()) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: userId.trim(), top: "50" });
      const res = await fetch(
        `/api/admin/knowledge-graph?${params.toString()}`,
      );
      if (res.status === 403) {
        setError("Admin-only — your Clerk session is not authorised.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GraphSummary = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchGraph(userInput);
    }, 350);
    return () => clearTimeout(t);
  }, [userInput, fetchGraph]);

  return (
    <main className="relative min-h-screen bg-[#030303] text-neutral-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <Link
            href="/dashboard/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" /> back to admin
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-rose-300">
                <Crown className="h-3 w-3" />
                Admin-only · knowledge graph
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                The entity-relationship brain
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Every signed agent run feeds extracted entities (domains, URLs,
                dollar amounts, dates, named entities) into the graph.
                Top-degree nodes are the platform&apos;s most-referenced
                concepts. Pick a user to inspect their accumulated map.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchGraph(userInput)}
              disabled={loading || !userInput.trim()}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-neutral-400 backdrop-blur-xl transition hover:text-neutral-200 disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="mb-8 relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="user_… (Clerk user id)"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-3 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          />
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!userInput.trim() && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-neutral-500">
            Enter a user id above to inspect their accumulated knowledge graph.
          </div>
        )}

        {data && !error && (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.nodeCounts.slice(0, 4).map((c) => (
                <motion.div
                  key={c.type}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent p-5 backdrop-blur-xl"
                >
                  <div className="mb-3 inline-flex items-center gap-1.5 text-neutral-400">
                    <Network className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
                      {c.type}
                    </span>
                  </div>
                  <div className="font-mono text-2xl font-bold leading-none text-white">
                    {c.count.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </section>

            <div className="mb-6 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
              <span>
                <span className="text-neutral-400">Edges:</span>{" "}
                <span className="font-mono text-neutral-300">
                  {data.edgeCount.toLocaleString()}
                </span>
              </span>
              <span>·</span>
              <span>
                <span className="text-neutral-400">Top nodes shown:</span>{" "}
                <span className="font-mono text-neutral-300">
                  {data.topNodes.length}
                </span>
              </span>
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
              <div className="border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                Top-degree nodes
              </div>
              {data.topNodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-neutral-500">
                  No nodes yet — once this user runs a few agents, entities
                  start landing here.
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {data.topNodes.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-white/[0.02]"
                    >
                      <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span
                          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${nodeStyle(
                            n.nodeType,
                          )}`}
                        >
                          {n.nodeType}
                        </span>
                        <span
                          className="truncate font-mono text-[12px] text-white"
                          title={n.label}
                        >
                          {n.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] text-neutral-500">
                        <span>
                          <span className="text-neutral-400">degree</span>{" "}
                          {n.degree}
                        </span>
                        <span>
                          <span className="text-neutral-400">conf</span>{" "}
                          {n.confidence}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {data
              ? `${data.userId} · ${data.nodeCounts.reduce((s, c) => s + c.count, 0)} nodes · ${data.edgeCount} edges`
              : "—"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/api/admin/knowledge-graph?userId=${encodeURIComponent(userInput)}`}
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/dashboard/admin/memories"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              memories →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
