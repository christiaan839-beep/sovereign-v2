"use client";

/**
 * SOVEREIGN MATRIX — Public `/metrics` page (Wave 117).
 *
 * Renders the wave-116 M8 extended metrics endpoint as a public,
 * brand-consistent dashboard. The whole point: replace marketing
 * claims like "99.98% uptime" with a live, auditable read of the
 * agent_runs receipt fabric.
 *
 * Reads /api/status/metrics/extended every 60s. The endpoint itself
 * caches 60s upstream, so the network footprint is tiny.
 *
 * Why this is a landing-page proof point:
 *   - Visitors see per-model cost-savings vs an all-Claude-Sonnet
 *     baseline — concrete USD numbers, not "we save money on routing."
 *   - The trust-decision distribution shows the verifier actually
 *     blocks bad outputs at the published rate.
 *   - The per-agent p95 table shows which agents are slow, which is
 *     the kind of disclosure no closed-source competitor publishes.
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  RefreshCw,
  TrendingDown,
  Gauge,
  ShieldCheck,
  Boxes,
} from "lucide-react";

type Window = "24h" | "7d" | "30d";

interface AgentRowMetric {
  agentName: string;
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  successRate: number;
}

interface ModelDistribution {
  model: string;
  count: number;
  share: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
}

interface TrustDecisionDistribution {
  decision: string;
  count: number;
  share: number;
}

interface ExtendedMetrics {
  window: Window;
  generatedAt: string;
  totalRuns: number;
  slowestAgents: AgentRowMetric[];
  busiestAgents: AgentRowMetric[];
  models: ModelDistribution[];
  trustDecisions: TrustDecisionDistribution[];
  costSavings: {
    actualUsd: number;
    baselineUsd: number;
    savedUsd: number;
    savedPct: number;
  };
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function MetricsPage() {
  const [window, setWindow] = useState<Window>("24h");
  const [metrics, setMetrics] = useState<ExtendedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/status/metrics/extended?window=${window}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ExtendedMetrics = await res.json();
      setMetrics(data);
      setLastFetch(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  const showEmpty = metrics && metrics.totalRuns === 0;

  return (
    <main className="relative min-h-screen bg-[#030303] text-neutral-200">
      {/* Faint receipt-paper grid, identical motif to /status */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300">
              <Activity className="h-3 w-3" />
              Live · audited from agent_runs receipts
            </div>
            <h1 className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
              Platform metrics
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
              Live performance, cost, and trust numbers — computed every minute
              from the agent_runs receipt fabric. Every figure here is
              reproducible: query the same table and you get the same answer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-xl">
              {(["24h", "7d", "30d"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindow(w)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                    window === w
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchMetrics}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-neutral-400 backdrop-blur-xl transition hover:text-neutral-200 disabled:opacity-50"
              aria-label="Refresh metrics"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            Failed to load metrics: {error}
          </div>
        )}

        {showEmpty && (
          <div className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-neutral-400 backdrop-blur-xl">
            No agent runs in the last {window}. Once usage starts landing in the
            agent_runs receipt fabric, this dashboard auto-fills.
          </div>
        )}

        {metrics && !showEmpty && (
          <>
            {/* ─── Hero stat row ─── */}
            <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat
                icon={<Boxes className="h-4 w-4" />}
                label="Total runs"
                value={metrics.totalRuns.toLocaleString()}
                accent="cyan"
              />
              <HeroStat
                icon={<TrendingDown className="h-4 w-4" />}
                label="Cost saved vs baseline"
                value={fmtUsd(metrics.costSavings.savedUsd)}
                sub={`${fmtPct(metrics.costSavings.savedPct)} below all-Claude-Sonnet`}
                accent="copper"
              />
              <HeroStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Auto-approved"
                value={fmtPct(
                  metrics.trustDecisions.find(
                    (d) => d.decision === "auto-approved",
                  )?.share ?? 0,
                )}
                sub="trust-verifier decisions"
                accent="cyan"
              />
              <HeroStat
                icon={<Gauge className="h-4 w-4" />}
                label="Active models"
                value={String(metrics.models.length)}
                sub="distributing live traffic"
                accent="copper"
              />
            </div>

            {/* ─── Model distribution ─── */}
            <Section
              title="Model distribution"
              sub="Where the cascade router is sending live traffic"
            >
              <Table
                cols={["Model", "Runs", "Share", "Avg latency", "Est. cost"]}
                rows={metrics.models.map((m) => [
                  m.model,
                  m.count.toLocaleString(),
                  fmtPct(m.share),
                  fmtMs(m.avgLatencyMs),
                  fmtUsd(m.estimatedCostUsd),
                ])}
                emphasizeFirst
              />
            </Section>

            {/* ─── Slowest + busiest agents ─── */}
            <div className="grid gap-8 lg:grid-cols-2">
              <Section
                title="Top 10 busiest agents"
                sub="Volume drivers (last window)"
              >
                <Table
                  cols={["Agent", "Runs", "p50", "p95", "Success"]}
                  rows={metrics.busiestAgents.map((a) => [
                    a.agentName,
                    a.count.toLocaleString(),
                    fmtMs(a.p50Ms),
                    fmtMs(a.p95Ms),
                    fmtPct(a.successRate),
                  ])}
                  emphasizeFirst
                />
              </Section>

              <Section
                title="Top 10 slowest agents"
                sub="Ranked by p95 latency — where to optimise next"
              >
                <Table
                  cols={["Agent", "Runs", "p50", "p95", "Success"]}
                  rows={metrics.slowestAgents.map((a) => [
                    a.agentName,
                    a.count.toLocaleString(),
                    fmtMs(a.p50Ms),
                    fmtMs(a.p95Ms),
                    fmtPct(a.successRate),
                  ])}
                  emphasizeFirst
                />
              </Section>
            </div>

            {/* ─── Trust decisions ─── */}
            <Section
              title="Trust-verifier decisions"
              sub="Output-pipeline breakdown across all runs"
            >
              <Table
                cols={["Decision", "Count", "Share"]}
                rows={metrics.trustDecisions.map((d) => [
                  d.decision,
                  d.count.toLocaleString(),
                  fmtPct(d.share),
                ])}
                emphasizeFirst
              />
            </Section>
          </>
        )}

        {/* Footer */}
        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {lastFetch ? (
              <>
                Updated{" "}
                <time dateTime={lastFetch.toISOString()}>
                  {lastFetch.toLocaleTimeString()}
                </time>
                {" · "}re-polled every 60s
              </>
            ) : (
              "Loading metrics…"
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/status/metrics/extended"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/status"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              uptime & probes →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────── */

function HeroStat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "cyan" | "copper";
}) {
  const accentText = accent === "cyan" ? "text-cyan-300" : "text-amber-300";
  const accentBg =
    accent === "cyan"
      ? "from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent"
      : "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${accentBg} p-5 backdrop-blur-xl`}
    >
      <div className={`mb-3 inline-flex items-center gap-1.5 ${accentText}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="font-mono text-2xl font-bold leading-none text-white">
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-white">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[12px] text-neutral-500">{sub}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        {children}
      </div>
    </section>
  );
}

function Table({
  cols,
  rows,
  emphasizeFirst,
}: {
  cols: string[];
  rows: Array<Array<string>>;
  emphasizeFirst?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-neutral-500">
        No data in this window.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-white/[0.04] bg-white/[0.01]">
            {cols.map((c) => (
              <th
                key={c}
                className="px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-3 font-mono ${
                    emphasizeFirst && j === 0
                      ? "text-white"
                      : "text-neutral-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
