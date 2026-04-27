"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Layers,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ModelBreakdown {
  model: string;
  calls: number;
  costUsd: string;
}

interface TenantCost {
  userId: string;
  plan: string;
  monthlyRevenueUsd: string;
  totalCalls: number;
  infraCostUsd: string;
  grossMarginUsd: string;
  grossMarginPct: number;
  byModel: ModelBreakdown[];
}

interface CostsPayload {
  windowDays: number;
  tenantCount: number;
  platformTotals: {
    revenueUsd: string;
    infraCostUsd: string;
    grossMarginUsd: string;
    blendedMarginPct: number;
  };
  tenants: TenantCost[];
}

const WINDOWS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function TenantCostsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<CostsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/_admin/tenant-costs?days=${days}`)
      .then(async (r) => {
        if (r.status === 404)
          throw new Error(
            "Admin access required. Add your Clerk userId to ADMIN_USER_IDS.",
          );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: CostsPayload) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 px-4 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] uppercase tracking-widest text-emerald-400/80 mb-4">
              <Layers className="w-3 h-3" /> Admin · Per-tenant infra spend
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mb-3">
              Tenant Costs
            </h1>
            <p className="text-sm text-neutral-500 max-w-2xl">
              Real per-account infra spend vs subscription revenue. Costs are
              estimated from the model rate card and the call counts in the
              <code className="text-emerald-400/80"> usage</code> table.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={() => setDays(w.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  days === w.days
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div className="flex items-center gap-3 text-neutral-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Computing window…
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-200">{error}</div>
          </div>
        )}

        {data && (
          <>
            {/* Platform totals */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <PlatformStat
                label="Tenants"
                value={String(data.tenantCount)}
                accent="text-white"
              />
              <PlatformStat
                label={`Revenue · ${data.windowDays}d`}
                value={data.platformTotals.revenueUsd}
                accent="text-emerald-400"
              />
              <PlatformStat
                label={`Infra cost · ${data.windowDays}d`}
                value={data.platformTotals.infraCostUsd}
                accent="text-cyan-400"
              />
              <PlatformStat
                label="Blended margin"
                value={`${data.platformTotals.blendedMarginPct}%`}
                accent={
                  data.platformTotals.blendedMarginPct > 80
                    ? "text-emerald-400"
                    : data.platformTotals.blendedMarginPct > 60
                      ? "text-amber-400"
                      : "text-red-400"
                }
              />
            </div>

            {/* Tenant table */}
            <div className="rounded-2xl border border-white/[0.05] overflow-hidden bg-white/[0.02]">
              <div className="grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr_0.8fr_0.6fr_0.4fr] px-5 py-3 text-[10px] uppercase tracking-widest text-neutral-600 border-b border-white/[0.05]">
                <div>User</div>
                <div className="text-right">Plan</div>
                <div className="text-right">Calls</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Infra</div>
                <div className="text-right">Margin</div>
                <div></div>
              </div>

              {data.tenants.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-neutral-600">
                  No usage in the last {data.windowDays} days.
                </div>
              ) : (
                data.tenants.map((t, idx) => (
                  <motion.div
                    key={t.userId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <button
                      onClick={() => toggle(t.userId)}
                      className="w-full grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr_0.8fr_0.6fr_0.4fr] px-5 py-4 text-left text-xs hover:bg-white/[0.02] transition-colors border-b border-white/[0.04]"
                    >
                      <div className="font-mono text-neutral-300 truncate">
                        {t.userId}
                      </div>
                      <div className="text-right text-neutral-400">
                        {t.plan}
                      </div>
                      <div className="text-right text-neutral-400">
                        {t.totalCalls.toLocaleString()}
                      </div>
                      <div className="text-right text-emerald-400">
                        {t.monthlyRevenueUsd}
                      </div>
                      <div className="text-right text-cyan-400">
                        {t.infraCostUsd}
                      </div>
                      <div
                        className={`text-right font-semibold ${
                          t.grossMarginPct > 80
                            ? "text-emerald-400"
                            : t.grossMarginPct > 60
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {t.grossMarginPct}%
                      </div>
                      <div className="text-right text-neutral-500">
                        {expanded.has(t.userId) ? (
                          <ChevronUp className="w-4 h-4 inline" />
                        ) : (
                          <ChevronDown className="w-4 h-4 inline" />
                        )}
                      </div>
                    </button>

                    {expanded.has(t.userId) && (
                      <div className="px-5 py-3 bg-black/40 border-b border-white/[0.04]">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
                          By model
                        </div>
                        <div className="grid grid-cols-[1.5fr_0.6fr_0.6fr] gap-3 text-xs">
                          {t.byModel.map((m) => (
                            <ModelRow key={m.model} model={m} />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-widest">
              <TrendingUp className="w-3 h-3" /> Costs derived from
              src/lib/model-rate-card.ts. Update when provider invoicing
              changes.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
        {label}
      </div>
      <div className={`text-2xl font-black tracking-tight ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function ModelRow({ model }: { model: ModelBreakdown }) {
  return (
    <>
      <div className="text-neutral-300 font-mono">{model.model}</div>
      <div className="text-right text-neutral-500">
        {model.calls.toLocaleString()} calls
      </div>
      <div className="text-right text-cyan-400">{model.costUsd}</div>
    </>
  );
}
