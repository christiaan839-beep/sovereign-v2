"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

/**
 * /dashboard/admin/eval-health — admin-only page showing the eval
 * trend over the last 30 runs plus the latest per-eval breakdown.
 *
 * Minimal inline SVG chart to avoid pulling in a chart library.
 * Sparkline with pass-rate per run + color-coded threshold line at 95%.
 */

interface RunSummary {
  id: string;
  startedAt: string;
  trigger: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  durationMs: number | null;
}

interface ResultRow {
  evalSlug: string;
  agentSlug: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number | null;
  errorMessage: string | null;
  outputHash: string | null;
}

export default function EvalHealthPage() {
  const [data, setData] = useState<{ runs: RunSummary[]; latestResults: ResultRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/eval-health")
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Admin access required" : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return (
      <div className="p-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.04]">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10 text-neutral-500 text-sm">Loading eval health…</div>
    );
  }

  const { runs, latestResults } = data;
  const latest = runs[0];
  const previous = runs[1];
  const trendingDown = previous && latest && latest.passRate < previous.passRate;
  const failedResults = latestResults.filter((r) => r.status === "failed");

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Eval Health</h1>
            <p className="text-sm text-neutral-500">
              Continuous agent-quality signal · updated every 6 hours
            </p>
          </div>
        </header>

        {/* Top-line stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Latest pass rate"
            value={latest ? `${(latest.passRate * 100).toFixed(1)}%` : "—"}
            tone={latest ? (latest.passRate >= 0.95 ? "good" : latest.passRate >= 0.85 ? "warn" : "bad") : "neutral"}
          />
          <StatCard
            label="Trend vs prior"
            value={previous && latest
              ? `${((latest.passRate - previous.passRate) * 100).toFixed(1)}pp`
              : "—"}
            tone={trendingDown ? "bad" : "good"}
          />
          <StatCard
            label="Last run duration"
            value={latest?.durationMs ? `${(latest.durationMs / 1000).toFixed(1)}s` : "—"}
            tone="neutral"
          />
          <StatCard
            label="Runs tracked"
            value={String(runs.length)}
            tone="neutral"
          />
        </div>

        {/* Sparkline — pass rate over last 30 runs */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Pass rate — last {runs.length} runs</h3>
          <Sparkline runs={runs} />
        </div>

        {/* Currently-failing evals */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">
            Currently failing ({failedResults.length})
          </h3>
          {failedResults.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> All evals passing
            </div>
          ) : (
            <div className="space-y-2">
              {failedResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/[0.04] border border-rose-500/15"
                >
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white">
                      {r.agentSlug} · {r.evalSlug}
                    </p>
                    {r.errorMessage && (
                      <p className="text-xs text-neutral-400 mt-1 font-mono truncate">{r.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent runs table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <h3 className="text-sm font-semibold text-white p-5 pb-3">Recent runs</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-white/[0.06] text-neutral-500 uppercase tracking-wider text-[10px]">
                <th className="text-left px-5 py-2">When</th>
                <th className="text-left px-5 py-2">Trigger</th>
                <th className="text-right px-5 py-2">Passed</th>
                <th className="text-right px-5 py-2">Failed</th>
                <th className="text-right px-5 py-2">Skipped</th>
                <th className="text-right px-5 py-2">Rate</th>
                <th className="text-right px-5 py-2 pr-5">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04] text-neutral-300">
                  <td className="px-5 py-2 font-mono text-neutral-500">{formatDate(r.startedAt)}</td>
                  <td className="px-5 py-2 text-neutral-400">{r.trigger}</td>
                  <td className="px-5 py-2 text-right text-emerald-400">{r.passed}</td>
                  <td className={`px-5 py-2 text-right ${r.failed > 0 ? "text-rose-400" : "text-neutral-500"}`}>{r.failed}</td>
                  <td className="px-5 py-2 text-right text-neutral-500">{r.skipped}</td>
                  <td className="px-5 py-2 text-right font-mono">{(r.passRate * 100).toFixed(1)}%</td>
                  <td className="px-5 py-2 pr-5 text-right font-mono text-neutral-500">
                    {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const colors = {
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-rose-400",
    neutral: "text-white",
  }[tone];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">{label}</p>
      <p className={`text-2xl font-mono ${colors}`}>{value}</p>
    </div>
  );
}

/** Inline SVG sparkline — avoids pulling in a chart library. */
function Sparkline({ runs }: { runs: RunSummary[] }) {
  if (runs.length < 2) {
    return <p className="text-xs text-neutral-500">Need at least 2 runs for a trend.</p>;
  }
  // Oldest → newest for chart
  const data = [...runs].reverse();
  const W = 800;
  const H = 120;
  const pad = 20;
  const points = data.map((r, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad);
    const y = H - pad - r.passRate * (H - 2 * pad);
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const ninetyFiveY = H - pad - 0.95 * (H - 2 * pad);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      {/* 95% threshold line */}
      <line x1={pad} x2={W - pad} y1={ninetyFiveY} y2={ninetyFiveY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
      <text x={W - pad} y={ninetyFiveY - 4} fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace" textAnchor="end">
        95%
      </text>
      {/* Path */}
      <path d={path} fill="none" stroke="#B5532C" strokeWidth={2} />
      {/* Dots */}
      {points.map(([x, y], i) => {
        const rate = data[i].passRate;
        const fill = rate >= 0.95 ? "#10b981" : rate >= 0.85 ? "#f59e0b" : "#ef4444";
        return <circle key={i} cx={x} cy={y} r={2.5} fill={fill} />;
      })}
    </svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
