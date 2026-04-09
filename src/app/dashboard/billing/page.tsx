"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, Zap, BarChart3, Activity, CheckCircle2,
  ExternalLink, Loader2, AlertTriangle, ArrowUpRight,
  Clock, FileText, Receipt,
} from "lucide-react";
import { useUsage } from "@/hooks/useUsage";
import { useSafeUser } from "@/lib/safe-clerk";
import { Skeleton } from "@/components/ui/Skeleton";

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: "paid" | "pending" | "failed";
  description: string;
}

export default function BillingPage() {
  const { today, limit, total, plan, loaded, isPaid } = useUsage();
  const { user: _user } = useSafeUser();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  // Attempt to load payment history
  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/_billing/portal", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.invoices && Array.isArray(data.invoices)) {
            setInvoices(data.invoices);
          }
        }
      } catch {
        // Billing API not configured yet — show empty state
      } finally {
        setInvoicesLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  // Monthly usage calculations
  const monthlyLimit = isPaid ? 10000 : 50;
  const monthlyUsed = total;
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
  const usagePercent = monthlyLimit > 0 ? Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100)) : 0;

  const planDisplay = (() => {
    switch (plan) {
      case "free": return "Free";
      case "starter": return "Starter";
      case "founder": return "Founder";
      case "array": return "Growth";
      case "node": return "Sovereign Node";
      case "enterprise": return "Enterprise";
      default: return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Free";
    }
  })();

  const planPrice = (() => {
    switch (plan) {
      case "starter": return "$19/mo";
      case "array": return "$49/mo";
      case "node": return "$199/mo";
      case "enterprise": return "$499/mo";
      default: return "$0/mo";
    }
  })();

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/_billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else if (res.status === 503) {
        setPortalError("Billing portal is being configured. Please try again shortly.");
      } else if (res.status === 404) {
        setPortalError("No active subscription found. Subscribe to a plan first.");
      } else {
        setPortalError(data.error || "Could not open billing portal.");
      }
    } catch {
      setPortalError("Connection failed. Please check your internet and try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 lg:p-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            <CreditCard className="w-3 h-3" /> Billing
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Billing &amp; Usage</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage your subscription, track usage, and view payment history.
        </p>
      </header>

      {/* Error Banner */}
      {portalError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300 flex-1">{portalError}</p>
          <button
            onClick={() => setPortalError(null)}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Current Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block mb-1">
              Current Plan
            </span>
            {!loaded ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-black text-white">{planDisplay}</h2>
                <span className="text-sm text-neutral-400">{planPrice}</span>
              </div>
            )}
            {loaded && (
              <p className="text-xs text-neutral-500 mt-1">
                {isPaid
                  ? "Your subscription renews monthly. Manage or cancel anytime."
                  : "You&apos;re on the free tier. Upgrade to unlock more agents and runs."}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <a
              href="/pricing"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Upgrade Plan
            </a>
            {isPaid && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Manage Subscription
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Usage Stats */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Usage This Month</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-neutral-400">Tasks Used</span>
            </div>
            {!loaded ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <span className="text-2xl font-bold text-white">{monthlyUsed.toLocaleString()}</span>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-neutral-400">Tasks Remaining</span>
            </div>
            {!loaded ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {isPaid && monthlyLimit >= 10000 ? "Unlimited" : monthlyRemaining.toLocaleString()}
              </span>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-neutral-400">Today&apos;s Usage</span>
            </div>
            {!loaded ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <span className="text-2xl font-bold text-white">{today} / {limit}</span>
            )}
          </motion.div>
        </div>

        {/* Usage Progress Bar */}
        {loaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-neutral-400">Monthly Usage</span>
              <span className="text-xs font-mono text-neutral-500">
                {monthlyUsed.toLocaleString()} / {isPaid && monthlyLimit >= 10000 ? "10,000+" : monthlyLimit.toLocaleString()} runs
              </span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  usagePercent >= 90
                    ? "bg-rose-500"
                    : usagePercent >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
            {usagePercent >= 80 && (
              <p className="text-[10px] text-amber-400 mt-2">
                You&apos;ve used {usagePercent}% of your monthly limit.{" "}
                <a href="/pricing" className="underline hover:text-amber-300">
                  Upgrade for more capacity
                </a>
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-4">Payment History</h2>
        {invoicesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : invoices.length > 0 ? (
          <div className="border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Date</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Description</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Amount</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/[0.03] last:border-0">
                    <td className="px-5 py-4 text-sm text-neutral-300">{inv.date}</td>
                    <td className="px-5 py-4 text-sm text-neutral-300">{inv.description}</td>
                    <td className="px-5 py-4 text-sm font-mono text-white">{inv.amount}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : inv.status === "pending"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {inv.status === "paid" && <CheckCircle2 className="w-3 h-3" />}
                        {inv.status === "pending" && <Clock className="w-3 h-3" />}
                        {inv.status === "failed" && <AlertTriangle className="w-3 h-3" />}
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.01]"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-5 h-5 text-neutral-500" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">No payment history</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {isPaid
                ? "Your invoices will appear here after your first billing cycle."
                : "Payment history will appear here once you upgrade to a paid plan."}
            </p>
          </motion.div>
        )}
      </div>

      {/* Plan Comparison Quick Cards */}
      {loaded && !isPaid && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-sm font-semibold text-white mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Starter", price: "$19/mo", runs: "200 runs/month", highlight: false },
              { name: "Growth", price: "$49/mo", runs: "500 runs/month", highlight: true },
              { name: "Sovereign Node", price: "$199/mo", runs: "2,000 runs/month", highlight: false },
            ].map((p) => (
              <div
                key={p.name}
                className={`p-5 rounded-xl border transition-colors ${
                  p.highlight
                    ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/30"
                    : "border-white/5 bg-white/[0.01] hover:border-white/10"
                }`}
              >
                {p.highlight && (
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-2 block">
                    Popular
                  </span>
                )}
                <h3 className="text-sm font-bold text-white">{p.name}</h3>
                <div className="flex items-baseline gap-1 mt-1 mb-2">
                  <span className="text-lg font-black text-white">{p.price}</span>
                </div>
                <p className="text-[10px] text-neutral-500 mb-3">{p.runs}</p>
                <a
                  href="/pricing"
                  className="flex items-center justify-center gap-1 w-full py-2 rounded-lg text-xs font-semibold transition-colors bg-white/5 text-neutral-300 hover:bg-white/10"
                >
                  View Details <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer Note */}
      {loaded && (
        <div className="flex items-center justify-center gap-2 py-2">
          <FileText className="w-3 h-3 text-neutral-600" />
          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
            Questions? Contact{" "}
            <a
              href="mailto:hello@sovereignmatrix.agency"
              className="text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              hello@sovereignmatrix.agency
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
