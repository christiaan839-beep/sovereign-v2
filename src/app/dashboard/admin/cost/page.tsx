"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertCircle, TrendingUp } from "lucide-react";

/**
 * /dashboard/admin/cost — admin-only. Answers "where is our AI spend
 * going?" in one page. Reads /api/admin/cost-breakdown.
 */

interface CostData {
  window: "7d" | "30d";
  sinceIso: string;
  allTimeCents: number;
  windowCents: number;
  windowRequests: number;
  topAgents: Array<{ agentId: string; cents: number; requests: number }>;
  topUsers: Array<{ userId: string; cents: number; requests: number }>;
  byProvider: Array<{ provider: string | null; cents: number; requests: number; tokens: number }>;
}

export default function CostBreakdownPage() {
  const [window, setWindow] = useState<"7d" | "30d">("30d");
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/cost?window=${window}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Admin access required" : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [window]);

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
    return <div className="p-10 text-neutral-500 text-sm">Loading cost data…</div>;
  }

  const avgPerRequest = data.windowRequests > 0 ? data.windowCents / data.windowRequests : 0;

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Cost Breakdown</h1>
              <p className="text-sm text-neutral-500">Where our AI spend is going</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["7d", "30d"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  window === w
                    ? "bg-[#B5532C]/15 border border-[#B5532C]/30 text-[#E08558]"
                    : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </header>

        {/* Top-line stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label={`Spent (${window})`} value={formatCents(data.windowCents)} />
          <StatCard label="Requests" value={data.windowRequests.toLocaleString()} />
          <StatCard label="Avg / request" value={formatCents(avgPerRequest)} />
          <StatCard label="All-time spend" value={formatCents(data.allTimeCents)} />
        </div>

        {/* By provider */}
        <Section title="By provider">
          <div className="space-y-2">
            {data.byProvider.length === 0 ? (
              <p className="text-sm text-neutral-500">No spend data in this window.</p>
            ) : (
              data.byProvider.map((p) => (
                <ProviderBar
                  key={p.provider ?? "unknown"}
                  provider={p.provider ?? "unknown"}
                  cents={p.cents}
                  max={data.byProvider[0]?.cents ?? 1}
                  requests={p.requests}
                  tokens={p.tokens}
                />
              ))
            )}
          </div>
        </Section>

        {/* Side-by-side: top agents + top users */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Top agents">
            <LeaderTable
              rows={data.topAgents.map((a) => ({
                key: a.agentId,
                label: a.agentId,
                primary: formatCents(a.cents),
                secondary: `${a.requests} runs`,
              }))}
            />
          </Section>
          <Section title="Top users">
            <LeaderTable
              rows={data.topUsers.map((u) => ({
                key: u.userId,
                label: u.userId.slice(0, 16) + (u.userId.length > 16 ? "…" : ""),
                primary: formatCents(u.cents),
                secondary: `${u.requests} runs`,
              }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5">{label}</p>
      <p className="text-2xl font-mono text-white">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-neutral-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderBar({ provider, cents, max, requests, tokens }: { provider: string; cents: number; max: number; requests: number; tokens: number }) {
  const pct = max > 0 ? (cents / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="font-mono text-neutral-300">{provider}</span>
        <span className="font-mono text-neutral-500">
          {formatCents(cents)} · {requests} req · {(tokens / 1000).toFixed(1)}k tok
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "linear-gradient(to right, #B5532C, #E08558)" }}
        />
      </div>
    </div>
  );
}

function LeaderTable({ rows }: { rows: Array<{ key: string; label: string; primary: string; secondary: string }> }) {
  if (rows.length === 0) return <p className="text-sm text-neutral-500">No data yet.</p>;
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-mono text-neutral-600 w-4">{i + 1}</span>
            <span className="text-xs font-mono text-neutral-300 truncate">{r.label}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono text-white">{r.primary}</p>
            <p className="text-[10px] font-mono text-neutral-500">{r.secondary}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
