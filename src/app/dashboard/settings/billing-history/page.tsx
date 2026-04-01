"use client";

import { motion } from "framer-motion";
import { CreditCard, Download, ArrowUpRight, Zap, CalendarDays, TrendingUp } from "lucide-react";

const INVOICES = [
  { id: "INV-2024-004", date: "Mar 1, 2026", amount: "$49.00", plan: "Pro", status: "paid" },
  { id: "INV-2024-003", date: "Feb 1, 2026", amount: "$49.00", plan: "Pro", status: "paid" },
  { id: "INV-2024-002", date: "Jan 1, 2026", amount: "$29.00", plan: "Starter", status: "paid" },
  { id: "INV-2024-001", date: "Dec 1, 2025", amount: "$29.00", plan: "Starter", status: "pending" },
];

const WEEKLY_RUNS = [
  { label: "Week 1", value: 124, pct: 62 },
  { label: "Week 2", value: 156, pct: 78 },
  { label: "Week 3", value: 198, pct: 99 },
  { label: "Week 4", value: 142, pct: 71 },
];

export default function BillingHistoryPage() {
  return (
    <motion.div role="main" aria-label="Billing history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }} className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10 space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Billing History</h1>
        <p className="text-sm text-neutral-500 mt-1">Invoices, usage, and plan details.</p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Current Plan</p>
            <p className="text-xl font-bold text-white mt-1 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400" />Pro</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white">$49<span className="text-sm font-normal text-neutral-500">/mo</span></p>
            <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-1"><CalendarDays className="w-3 h-3" />Next billing: Apr 1, 2026</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-neutral-400">Agent runs this month</span>
            <span className="text-xs text-neutral-400">142 / 200</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "71%" }} transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
          </div>
        </div>
      </div>

      {/* Usage chart */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-5"><TrendingUp className="w-4 h-4 text-neutral-400" />Agent Runs Per Week</h2>
        <div className="flex items-end gap-3 h-36">
          {WEEKLY_RUNS.map((w, i) => (
            <div key={w.label} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">{w.value}</span>
              <motion.div initial={{ height: 0 }} animate={{ height: `${w.pct}%` }} transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                className="w-full rounded-t-md bg-gradient-to-t from-blue-600/60 to-blue-400/40 min-h-[4px]" />
              <span className="text-[10px] text-neutral-500">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-2xl">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><CreditCard className="w-4 h-4 text-neutral-400" />Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04] text-neutral-500 text-[11px] uppercase tracking-wider">
                <th className="text-left px-5 py-2.5 font-semibold">Date</th>
                <th className="text-left px-5 py-2.5 font-semibold">Amount</th>
                <th className="text-left px-5 py-2.5 font-semibold">Plan</th>
                <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                <th className="text-right px-5 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {INVOICES.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-neutral-300">{inv.date}</td>
                  <td className="px-5 py-3 text-white font-medium">{inv.amount}</td>
                  <td className="px-5 py-3 text-neutral-400">{inv.plan}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button aria-label={`Download invoice ${inv.id}`} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade CTA */}
      <button aria-label="Upgrade plan" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors">
        <ArrowUpRight className="w-4 h-4" />Upgrade Plan
      </button>
    </motion.div>
  );
}
