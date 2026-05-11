"use client";

/**
 * /dashboard/audit — receipt-backed audit analytics.
 *
 * Aggregates the last N days of `agent_runs` (the platform's audit trail)
 * into the metrics product teams actually screenshot for stakeholders:
 *   - daily invocation chart (pure SVG, no chart lib)
 *   - safety pass rate (big number + breakdown)
 *   - p50 / p95 / p99 latency tiles
 *   - top agents by volume
 *   - flagged-output counts (jailbreak / pii / content / critic)
 *
 * Distinct from /dashboard/insights (plan usage) and /dashboard/usage
 * (run quotas). This view is the audit-grade companion to /dashboard/receipts
 * and the metric layer behind the SOC2 evidence pack.
 */

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Shield,
  Zap,
  AlertTriangle,
  Loader2,
  TrendingUp,
  BarChart3,
  Cpu,
} from "lucide-react";

interface InsightsData {
  windowDays: number;
  truncated: boolean;
  totalRuns: number;
  safetyPassRate: number;
  blockedCount: number;
  flagged: {
    jailbreak: number;
    pii: number;
    content: number;
    critic: number;
  };
  avgQualityScore: number | null;
  latencyMs: { p50: number; p95: number; p99: number; avg: number };
  dailyInvocations: { date: string; count: number }[];
  topAgents: { name: string; count: number }[];
}

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatMs(n: number): string {
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

function Sparkline({
  data,
  height = 96,
  width = 720,
}: {
  data: { date: string; count: number }[];
  height?: number;
  width?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-neutral-600">
        No runs yet
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = width / Math.max(1, data.length - 1);
  const padY = 6;
  const usable = height - padY * 2;
  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = padY + (1 - d.count / max) * usable;
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const lastX = points.at(-1)?.[0] ?? 0;
  const firstX = points[0]?.[0] ?? 0;
  const areaPath = `${linePath} L${lastX.toFixed(2)},${height} L${firstX.toFixed(2)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-24 w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="audit-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#audit-spark-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="rgb(34 211 238)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={2}
          fill="rgb(34 211 238)"
          opacity={data[i]!.count > 0 ? 0.9 : 0.2}
        />
      ))}
    </svg>
  );
}

function BarList({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-neutral-600">
        No agent runs in this window
      </p>
    );
  }
  const max = Math.max(...items.map((a) => a.count));
  return (
    <div className="space-y-2">
      {items.map((agent) => {
        const pct = max === 0 ? 0 : (agent.count / max) * 100;
        return (
          <div key={agent.name} className="flex items-center gap-3">
            <div className="w-32 truncate font-mono text-xs text-neutral-300">
              {agent.name}
            </div>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-cyan-400/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right font-mono text-xs text-neutral-400">
              {agent.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditDashboardPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/me/insights?days=${days}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as InsightsData;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const safetyColor = useMemo(() => {
    if (!data) return "text-neutral-400";
    if (data.safetyPassRate >= 99) return "text-emerald-300";
    if (data.safetyPassRate >= 95) return "text-amber-300";
    return "text-rose-300";
  }, [data]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30">
              <BarChart3 className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Audit analytics
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Receipt-backed metrics across every agent run on your account.
                Numbers come straight from the signed audit trail.
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  days === r.days
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </motion.header>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !data ? null : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                Icon={Activity}
                label="Total runs"
                value={formatNum(data.totalRuns)}
                sub={`Last ${data.windowDays} days`}
              />
              <Stat
                Icon={Shield}
                label="Safety pass rate"
                value={`${data.safetyPassRate}%`}
                sub={
                  data.blockedCount > 0
                    ? `${data.blockedCount} blocked by verifier`
                    : "0 blocked"
                }
                valueClass={safetyColor}
              />
              <Stat
                Icon={Zap}
                label="p95 latency"
                value={formatMs(data.latencyMs.p95)}
                sub={`avg ${formatMs(data.latencyMs.avg)}`}
              />
              <Stat
                Icon={TrendingUp}
                label="Quality score"
                value={
                  data.avgQualityScore !== null
                    ? `${data.avgQualityScore}`
                    : "–"
                }
                sub="rolling avg"
              />
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white">
                  Invocations over time
                </h2>
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                  {data.dailyInvocations.length} days
                </span>
              </div>
              <Sparkline data={data.dailyInvocations} />
              <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
                <span>{data.dailyInvocations[0]?.date ?? ""}</span>
                <span>{data.dailyInvocations.at(-1)?.date ?? ""}</span>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-sm font-medium text-white">Top agents</h2>
                </div>
                <BarList items={data.topAgents} />
              </section>

              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <h2 className="text-sm font-medium text-white">
                    Flagged outputs
                  </h2>
                </div>
                <FlagRow
                  label="Jailbreak attempts blocked"
                  count={data.flagged.jailbreak}
                />
                <FlagRow label="PII detected" count={data.flagged.pii} />
                <FlagRow
                  label="Content policy violations"
                  count={data.flagged.content}
                />
                <FlagRow
                  label="Critic rejections"
                  count={data.flagged.critic}
                />
              </section>
            </div>

            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
              <h2 className="mb-3 text-sm font-medium text-white">
                Latency distribution
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <LatencyTile label="p50" ms={data.latencyMs.p50} />
                <LatencyTile label="p95" ms={data.latencyMs.p95} />
                <LatencyTile label="p99" ms={data.latencyMs.p99} />
              </div>
            </section>

            {data.truncated && (
              <p className="text-center text-[11px] text-neutral-600">
                Truncated to the most recent 5,000 runs in this window.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  sub,
  valueClass = "text-white",
}: {
  Icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`font-semibold tracking-tight ${valueClass} text-3xl`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}

function FlagRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2 text-xs last:border-b-0">
      <span className="text-neutral-300">{label}</span>
      <span
        className={`font-mono ${count > 0 ? "text-rose-300" : "text-neutral-500"}`}
      >
        {count}
      </span>
    </div>
  );
}

function LatencyTile({ label, ms }: { label: string; ms: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">
        {formatMs(ms)}
      </div>
    </div>
  );
}
