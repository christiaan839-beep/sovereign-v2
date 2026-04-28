"use client";

/**
 * /dashboard/admin/trace/[traceId] — flame-graph trace viewer.
 *
 * Renders an agent_traces row as a horizontal time-axis flame graph:
 * each span is a bar at its (startMs, durationMs) coordinates,
 * indented by parent depth, color-coded by kind.
 *
 * The forensic power-tool: see exactly what an agent did, when,
 * how long it took, what it cost, and where it failed.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Cpu,
  Wrench,
  GitBranch,
  Zap,
  AlertCircle,
  ArrowLeft,
  Clock,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";

interface Span {
  id: string;
  parentId: string | null;
  kind: "model_call" | "tool_call" | "agent_call" | "decision";
  name: string;
  startMs: number;
  durationMs: number;
  costCents: number;
  inputBytes: number;
  outputBytes: number;
  error?: string;
}

interface TraceRow {
  id: string;
  auditId: string | null;
  userId: string;
  agentName: string;
  totalDurationMs: number;
  totalCostCents: number;
  spans: Span[];
  spanCount: number;
  firstError: string | null;
  retainUntil: string;
  createdAt: string;
}

function spanKindColor(kind: Span["kind"]) {
  switch (kind) {
    case "model_call": return "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30";
    case "tool_call":  return "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30";
    case "agent_call": return "from-violet-500/20 to-violet-500/5 border-violet-500/30";
    case "decision":   return "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30";
  }
}

function spanKindIcon(kind: Span["kind"]) {
  switch (kind) {
    case "model_call": return <Cpu className="w-3 h-3" />;
    case "tool_call":  return <Wrench className="w-3 h-3" />;
    case "agent_call": return <GitBranch className="w-3 h-3" />;
    case "decision":   return <Zap className="w-3 h-3" />;
  }
}

function depthOf(span: Span, byId: Map<string, Span>): number {
  let depth = 0;
  let cursor = span.parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    depth += 1;
    cursor = parent.parentId;
  }
  return depth;
}

export default function TraceViewerPage() {
  const params = useParams<{ traceId: string }>();
  const [data, setData] = useState<TraceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.traceId) return;
    fetch(`/api/admin/trace/${encodeURIComponent(params.traceId)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) {
          setErr(`HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        const json = await r.json();
        setData(json.trace);
        setLoading(false);
      })
      .catch((e) => {
        setErr(String(e));
        setLoading(false);
      });
  }, [params?.traceId]);

  const totalMs = data?.totalDurationMs ?? 0;
  const byId = new Map(data?.spans.map((s) => [s.id, s]) ?? []);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/dashboard/admin/tenants"
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to tenants
        </Link>

        <h1 className="text-2xl md:text-3xl font-light text-white tracking-tight">
          Agent execution trace
        </h1>
        <p className="mt-2 text-sm text-neutral-400 max-w-3xl">
          Flame graph of every model call, tool call, sub-agent call,
          and decision step inside this run. Sourced from{" "}
          <code className="text-xs">agent_traces</code>; persisted at
          execution end (best-effort, never blocks the user response).
        </p>

        {loading && (
          <div className="mt-8 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-sm text-red-300">Failed to load: {err}</p>
          </div>
        )}

        {!loading && !err && data && (
          <>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryStat
                icon={<Cpu className="w-4 h-4" />}
                label="Agent"
                value={data.agentName}
              />
              <SummaryStat
                icon={<Clock className="w-4 h-4" />}
                label="Total duration"
                value={
                  totalMs < 1000
                    ? `${totalMs}ms`
                    : `${(totalMs / 1000).toFixed(2)}s`
                }
              />
              <SummaryStat
                icon={<CircleDollarSign className="w-4 h-4" />}
                label="Total cost"
                value={
                  data.totalCostCents > 0
                    ? `$${(data.totalCostCents / 100).toFixed(4)}`
                    : "free"
                }
              />
              <SummaryStat
                icon={<Zap className="w-4 h-4" />}
                label="Spans"
                value={String(data.spanCount)}
              />
            </div>

            {data.firstError && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">First error in trace</p>
                  <p className="mt-1 text-xs text-neutral-400 font-mono">{data.firstError}</p>
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-medium text-white mb-4">
                Flame graph
              </h2>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-4">
                <div className="space-y-1">
                  {data.spans.map((span, idx) => {
                    const depth = depthOf(span, byId);
                    const widthPct = totalMs > 0 ? (span.durationMs / totalMs) * 100 : 1;
                    const offsetPct = totalMs > 0 ? (span.startMs / totalMs) * 100 : 0;
                    const colorCls = spanKindColor(span.kind);
                    return (
                      <motion.div
                        key={span.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.005 }}
                        className="relative h-7 group"
                      >
                        <div
                          className={`absolute h-full rounded bg-gradient-to-r border ${colorCls} flex items-center px-2 gap-1.5 text-[10px] truncate`}
                          style={{
                            left: `calc(${offsetPct}% + ${depth * 12}px)`,
                            width: `max(${widthPct}%, 80px)`,
                            maxWidth: `calc(100% - ${offsetPct}% - ${depth * 12}px)`,
                          }}
                        >
                          {spanKindIcon(span.kind)}
                          <span className="truncate text-neutral-200 font-mono">
                            {span.name}
                          </span>
                          <span className="ml-auto text-neutral-400 tabular-nums">
                            {span.durationMs}ms
                          </span>
                          {span.error && (
                            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        {span.error && (
                          <div className="absolute left-0 top-full mt-0.5 text-[10px] text-red-300 font-mono truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {span.error}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-neutral-500">
                <LegendDot color="bg-emerald-400" label="model_call" />
                <LegendDot color="bg-cyan-400" label="tool_call" />
                <LegendDot color="bg-violet-400" label="agent_call" />
                <LegendDot color="bg-yellow-400" label="decision" />
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-medium text-white mb-4">
                All spans (table)
              </h2>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2">Kind</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2 text-right">Start</th>
                      <th className="px-4 py-2 text-right">Duration</th>
                      <th className="px-4 py-2 text-right">Cost</th>
                      <th className="px-4 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.spans.slice(0, 200).map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2 text-xs font-mono text-neutral-400">
                          {s.kind}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-neutral-300 truncate max-w-[300px]">
                          {s.name}
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-400">
                          {s.startMs}ms
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-300">
                          {s.durationMs}ms
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-400">
                          {s.costCents > 0 ? `$${(s.costCents / 100).toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-red-300 truncate max-w-[300px]">
                          {s.error ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium text-white truncate">
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
