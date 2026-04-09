"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

interface PlanData {
  plan: string;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  isPaid: boolean;
}

/**
 * UsageWidget — Shows monthly run usage with progress bar and upgrade prompt.
 * Fetches from /api/user/plan. Shows upgrade CTA when usage > 80%.
 */
export function UsageWidget() {
  const [data, setData] = useState<PlanData | null>(null);

  useEffect(() => {
    fetch("/api/user/plan")
      .then(r => r.json())
      .then(setData)
      .catch(() => null);
  }, []);

  if (!data || data.limit === 0) return null;

  const pct = data.limit >= 10_000 ? 0 : Math.min(100, Math.round((data.used / data.limit) * 100));
  const isHigh = pct >= 80;
  const isMaxed = pct >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="px-6 py-3"
    >
      <div className="max-w-3xl mx-auto">
        <div className={`p-4 rounded-xl border ${isMaxed ? "border-rose-500/30 bg-rose-500/[0.04]" : isHigh ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className={`w-3.5 h-3.5 ${isMaxed ? "text-rose-400" : isHigh ? "text-amber-400" : "text-emerald-400"}`} />
              <span className="text-xs font-semibold text-white">{data.planName} Plan</span>
              <span className="text-[10px] text-neutral-500">{data.used.toLocaleString()} / {data.limit >= 10_000 ? "Unlimited" : data.limit.toLocaleString()} runs this month</span>
            </div>
            {isHigh && !isMaxed && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-colors"
              >
                <TrendingUp className="w-3 h-3" /> Upgrade
              </Link>
            )}
            {isMaxed && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-colors"
              >
                Upgrade to continue <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {data.limit < 10_000 && (
            <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${isMaxed ? "bg-rose-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"}`}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
