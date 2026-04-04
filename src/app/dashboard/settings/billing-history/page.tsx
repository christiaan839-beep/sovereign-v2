"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CreditCard, ArrowUpRight, Zap, CalendarDays, TrendingUp, Loader2, Receipt } from "lucide-react";
import Link from "next/link";

interface UsageData {
  plan: { name: string; price: number; runLimit: number; status: string };
  usage: {
    executions: { last24h: number; last7d: number; last30d: number; allTime: number };
    usagePercent: number;
    runsRemaining: number;
  };
}

export default function BillingHistoryPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const plan = data?.plan;
  const usage = data?.usage;
  const planLabel = plan?.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : "Free";
  const price = plan?.price ?? 0;
  const runLimit = plan?.runLimit ?? 50;
  const used = usage?.executions.last30d ?? 0;
  const pct = runLimit > 0 ? Math.round((used / runLimit) * 100) : 0;

  return (
    <motion.div role="region" aria-label="Billing history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }} className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10 space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Billing &amp; Usage</h1>
        <p className="text-sm text-neutral-500 mt-1">Plan details and agent usage this month.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current plan card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Current Plan</p>
                <p className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />{planLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">
                  ${price}<span className="text-sm font-normal text-neutral-500">/mo</span>
                </p>
                <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-1">
                  <CalendarDays className="w-3 h-3" />
                  {plan?.status === "active" ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-neutral-400">Agent runs this month</span>
                <span className="text-xs text-neutral-400">{used.toLocaleString()} / {runLimit.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${pct > 90 ? "from-red-500 to-orange-500" : pct > 70 ? "from-amber-500 to-orange-500" : "from-emerald-500 to-cyan-500"}`}
                />
              </div>
            </div>
          </div>

          {/* Usage breakdown */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-neutral-400" />Usage Breakdown
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Last 24h", value: usage?.executions.last24h ?? 0 },
                { label: "Last 7 days", value: usage?.executions.last7d ?? 0 },
                { label: "All time", value: usage?.executions.allTime ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-lg font-bold text-white">{stat.value.toLocaleString()}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* No invoices yet — real billing via Yoco */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-white">Payment History</h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="w-8 h-8 text-neutral-700 mb-3" />
              <p className="text-sm text-neutral-500">No payments yet</p>
              <p className="text-xs text-neutral-600 mt-1">Invoices will appear here after your first payment via Yoco.</p>
            </div>
          </div>

          {/* Upgrade CTA */}
          {price === 0 && (
            <Link href="/pricing">
              <button aria-label="Upgrade plan" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors">
                <ArrowUpRight className="w-4 h-4" />Upgrade Plan
              </button>
            </Link>
          )}
        </>
      )}
    </motion.div>
  );
}
