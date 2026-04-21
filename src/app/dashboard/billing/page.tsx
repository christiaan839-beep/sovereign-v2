"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Loader2, CreditCard, ArrowUpRight, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, Clock, Receipt, Coins, RefreshCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  amountCents: number;
  type: string;
  description: string;
  agentId?: string;
  createdAt: string;
}

interface CreditsPayload {
  balance: number;          // cents
  lifetimeEarned: number;   // cents
  lifetimeSpent: number;    // cents
  displayBalance: string;   // "$X.XX"
  transactions: Transaction[];
}

// ─── Credit packages ─────────────────────────────────────────────────────────

const PACKAGES = [
  { cents: 500,  label: "$5",  credits: "500 credits",   desc: "For testing",   popular: false },
  { cents: 1000, label: "$10", credits: "1,000 credits", desc: "Starter",       popular: false },
  { cents: 2500, label: "$25", credits: "2,500 credits", desc: "Most popular",  popular: true  },
  { cents: 5000, label: "$50", credits: "5,000 credits", desc: "Power user",    popular: false },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

const EARN_TYPES = new Set(["purchase", "bonus", "referral", "a2e_earn"]);

function isEarn(type: string): boolean {
  return EARN_TYPES.has(type);
}

function typeLabel(type: string): string {
  switch (type) {
    case "purchase":   return "Purchase";
    case "bonus":      return "Bonus";
    case "referral":   return "Referral";
    case "a2e_earn":   return "A2E Earned";
    case "a2e_spend":  return "A2E Hire";
    case "refund":     return "Refund";
    default:           return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ w, h = "h-4" }: { w: string; h?: string }) {
  return (
    <div className={`${h} ${w} rounded bg-white/[0.06] animate-pulse`} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [data, setData] = useState<CreditsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as CreditsPayload;
      setData(json);
    } catch (err) {
      setFetchError("Could not load credits. Please refresh.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCredits(); }, [fetchCredits]);

  // Auto-dismiss toast after 4 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleBuy = async (cents: number) => {
    setBuying(cents);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, type: "purchase", description: "Credit purchase" }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setToast({ type: "success", msg: `${formatCents(cents)} credits added to your balance.` });
      await fetchCredits();
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Purchase failed." });
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 px-4 py-6 lg:px-8 lg:py-10">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-[6px] border backdrop-blur-xl shadow-2xl text-[13px] font-mono ${
              toast.type === "success"
                ? "border-[#B5532C]/30 bg-[#B5532C]/[0.08] text-white"
                : "border-rose-500/30 bg-rose-500/[0.06] text-rose-300"
            }`}
          >
            {toast.type === "success"
              ? <CheckCircle2 className="w-4 h-4 text-[#B5532C] shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.msg}
            <button onClick={() => setToast(null)} className="ml-2 text-neutral-500 hover:text-white transition-colors">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] pb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#B5532C] mb-1">
            Billing
          </p>
          <h1 className="font-serif text-3xl text-white tracking-tight">Credits &amp; Billing</h1>
          <p className="text-[13px] text-neutral-500 mt-1.5 leading-snug">
            Purchase credits, view your balance, and track A2E transactions.
          </p>
        </div>
        <button
          onClick={fetchCredits}
          aria-label="Refresh credits"
          className="p-2 border border-white/[0.08] hover:border-white/[0.16] rounded-[4px] transition-colors shrink-0"
        >
          <RefreshCcw className={`w-4 h-4 text-neutral-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* ── Run Credits (plan-1, user_credits ledger) ── */}
      <RunCreditsSection />

      {/* ── Error state ── */}
      {fetchError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-[6px] border border-rose-500/20 bg-rose-500/[0.04]"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-[13px] text-rose-300">{fetchError}</p>
          <button
            onClick={fetchCredits}
            className="ml-auto text-[12px] font-mono text-rose-400 hover:text-rose-200 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ── A. Balance Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-[8px] border border-[#B5532C]/25 bg-white/[0.025] backdrop-blur-xl overflow-hidden"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)" }}
      >
        {/* Copper top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(to right, rgba(181,83,44,0.9), rgba(181,83,44,0.15))" }}
          aria-hidden="true"
        />
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 20% 0%, rgba(181,83,44,0.08) 0%, transparent 65%)" }}
          aria-hidden="true"
        />

        <div className="relative p-7">
          {/* Label */}
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500 mb-4">
            Your Credit Balance
          </p>

          {/* Balance number */}
          {loading ? (
            <div className="space-y-2 mb-5">
              <Bone w="w-36" h="h-10" />
              <Bone w="w-56" h="h-3.5" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-4 mb-2">
                <span className="font-serif text-[52px] leading-none text-white tracking-tight tabular-nums">
                  {data?.displayBalance ?? "$0.00"}
                </span>
                <span className="font-mono text-[13px] text-neutral-500">USD</span>
              </div>
              <p className="text-[12px] font-mono text-neutral-500 mb-6">
                {data ? (data.balance / 1).toFixed(0) : "0"} credits available
                <span aria-hidden="true" className="mx-2 text-neutral-700">·</span>
                credits never expire
              </p>
            </>
          )}

          {/* Lifetime stats */}
          <div className="flex flex-wrap gap-8 pt-5 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600 mb-1">Lifetime Earned</p>
              {loading ? (
                <Bone w="w-20" h="h-5" />
              ) : (
                <p className="text-[16px] font-mono font-semibold text-emerald-400 tabular-nums">
                  {formatCents(data?.lifetimeEarned ?? 0)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600 mb-1">Lifetime Spent</p>
              {loading ? (
                <Bone w="w-20" h="h-5" />
              ) : (
                <p className="text-[16px] font-mono font-semibold text-[#B5532C] tabular-nums">
                  {formatCents(data?.lifetimeSpent ?? 0)}
                </p>
              )}
            </div>
          </div>

          {/* A2E explanation */}
          <p className="mt-5 text-[11px] font-mono text-neutral-600 leading-relaxed">
            Credits are used when agents hire other agents (A2E Economy).
            Each agent-to-agent hire costs a small credit fee, automatically deducted.
          </p>
        </div>
      </motion.div>

      {/* ── B. Buy Credits ── */}
      <section aria-labelledby="buy-credits-heading">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-1.5">Add Credits</p>
        <h2 id="buy-credits-heading" className="font-serif text-[22px] text-white mb-6 tracking-tight">
          Top up your balance
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PACKAGES.map((pkg, i) => (
            <motion.div
              key={pkg.cents}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={`group relative flex flex-col h-full p-5 rounded-[6px] border bg-white/[0.025] backdrop-blur-xl transition-all duration-300 overflow-hidden ${
                  pkg.popular
                    ? "border-[#B5532C]/35 hover:border-[#B5532C]/60"
                    : "border-white/[0.07] hover:border-[#B5532C]/25"
                }`}
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4)" }}
              >
                {/* Hover sweep */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                  style={{ background: "radial-gradient(circle at 15% 0%, rgba(181,83,44,0.12) 0%, transparent 60%)" }}
                />

                {/* Popular badge */}
                {pkg.popular && (
                  <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full bg-[#B5532C]/15 border border-[#B5532C]/35 text-[9px] font-mono text-[#B5532C] tracking-[0.12em] uppercase">
                    Popular
                  </span>
                )}

                <p className="relative font-serif text-[28px] text-white leading-none mb-1 tracking-tight">
                  {pkg.label}
                </p>
                <p className="relative text-[11px] font-mono text-[#B5532C] mb-0.5 tracking-tight">
                  {pkg.credits}
                </p>
                <p className="relative text-[11px] text-neutral-500 mb-5 flex-1">{pkg.desc}</p>

                <button
                  onClick={() => void handleBuy(pkg.cents)}
                  disabled={buying !== null}
                  aria-label={`Buy ${pkg.credits} for ${pkg.label}`}
                  className={`relative w-full py-2.5 rounded-[4px] font-mono text-[12px] tracking-wide transition-all duration-200 ${
                    pkg.popular
                      ? "bg-[#B5532C] text-white hover:bg-[#C96035] disabled:opacity-50"
                      : "border border-white/[0.12] text-neutral-300 hover:border-[#B5532C]/40 hover:text-white disabled:opacity-40"
                  }`}
                >
                  {buying === pkg.cents ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing…
                    </span>
                  ) : (
                    "Buy Now"
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-mono text-neutral-600">
          Stripe payment integration coming soon — credits added instantly for now.
        </p>
      </section>

      {/* ── C. Transaction History ── */}
      <section aria-labelledby="txn-heading">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-1.5">History</p>
        <h2 id="txn-heading" className="font-serif text-[22px] text-white mb-6 tracking-tight">
          Recent Transactions
        </h2>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-[6px] bg-white/[0.025] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : data && data.transactions.length > 0 ? (
          <div
            className="rounded-[8px] border border-white/[0.06] overflow-hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_120px_90px] gap-4 px-5 py-3 border-b border-white/[0.06] bg-white/[0.015]">
              {["Date", "Type", "Description", "Amount"].map((h) => (
                <span key={h} className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-600">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-white/[0.04]">
              <AnimatePresence initial={false}>
                {data.transactions.map((tx, i) => {
                  const earn = isEarn(tx.type);
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025, duration: 0.35 }}
                      className="grid grid-cols-[1fr_100px_120px_90px] gap-4 px-5 py-4 items-center hover:bg-white/[0.015] transition-colors"
                    >
                      {/* Date */}
                      <span className="text-[12px] font-mono text-neutral-400">
                        {formatDate(tx.createdAt)}
                      </span>

                      {/* Type badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-mono tracking-[0.1em] uppercase w-fit ${
                        earn
                          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-400"
                          : "border-[#B5532C]/25 bg-[#B5532C]/[0.07] text-[#B5532C]"
                      }`}>
                        {earn
                          ? <TrendingUp className="w-2.5 h-2.5" />
                          : <TrendingDown className="w-2.5 h-2.5" />}
                        {typeLabel(tx.type)}
                      </span>

                      {/* Description */}
                      <span className="text-[12px] text-neutral-500 truncate" title={tx.description}>
                        {tx.description}
                      </span>

                      {/* Amount */}
                      <span className={`text-[13px] font-mono font-semibold tabular-nums text-right ${earn ? "text-emerald-400" : "text-[#B5532C]"}`}>
                        {earn ? "+" : "−"}{formatCents(tx.amountCents)}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 rounded-[8px] border border-white/[0.06] bg-white/[0.015]"
          >
            <div
              className="w-12 h-12 rounded-[6px] border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4"
            >
              <Receipt className="w-5 h-5 text-neutral-600" />
            </div>
            <p className="text-[14px] text-neutral-400 font-medium mb-1">No transactions yet</p>
            <p className="text-[12px] text-neutral-600 font-mono">Buy credits to get started.</p>
          </motion.div>
        )}
      </section>

      {/* ── D. Plan upgrade hint ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-[6px] border border-white/[0.06] bg-white/[0.015]"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-[5px] border border-[#B5532C]/20 bg-[#B5532C]/[0.06] flex items-center justify-center shrink-0"
          >
            <Coins className="w-4.5 h-4.5 text-[#B5532C]" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-white leading-snug">Need more agent runs?</p>
            <p className="text-[12px] font-mono text-neutral-500 mt-0.5">
              Upgrade your plan for higher monthly run limits.
            </p>
          </div>
        </div>

        <Link
          href="/pricing"
          className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#030303] font-mono text-[12px] tracking-wide rounded-[4px] hover:bg-[#F4EFE6] transition-colors shrink-0"
        >
          View Plans
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </motion.div>

      {/* ── Stripe Billing link (for paid subscribers) ── */}
      <div className="flex items-center gap-2 pb-2">
        <CreditCard className="w-3.5 h-3.5 text-neutral-700" />
        <span className="text-[11px] font-mono text-neutral-600">
          Manage your subscription via{" "}
          <Link href="/dashboard/billing/subscription" className="text-neutral-500 hover:text-[#B5532C] transition-colors underline underline-offset-2">
            subscription settings
          </Link>
          {" · "}
          Questions?{" "}
          <a
            href="mailto:hello@sovereignmatrix.agency"
            className="text-neutral-500 hover:text-[#B5532C] transition-colors"
          >
            hello@sovereignmatrix.agency
          </a>
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * RunCreditsSection — Plan-1 user_credits balance + recent ledger
 *
 * Shows the user's credit balance for running agents (distinct from
 * the A2E credit system above, which is for agent-to-agent hiring).
 * Reads /api/credits/balance + /api/credits/history.
 *
 * A low balance shows a copper "Top up" CTA that scrolls to the
 * existing A2E purchase packages — the two systems share a top-up UX
 * so users never see "which kind of credits am I buying?" friction.
 * ─────────────────────────────────────────────────────────────── */
function RunCreditsSection() {
  const [balance, setBalance] = useState<{
    balanceCents: number;
    plan: string;
    monthlyAllocationCents: number;
    lowBalance: boolean;
  } | null>(null);
  const [history, setHistory] = useState<Array<{
    id: string;
    deltaCents: number;
    reason: string;
    createdAt: string;
  }>>([]);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setBalance(b))
      .catch(() => {});
    fetch("/api/credits/history?limit=5")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((b) => setHistory(b.entries ?? []))
      .catch(() => {});
  }, []);

  if (!balance) return null;

  const dollars = (balance.balanceCents / 100).toFixed(2);
  const allocation = (balance.monthlyAllocationCents / 100).toFixed(0);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Run Credits</h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Consumed by agent runs · {balance.plan} plan
            {balance.monthlyAllocationCents > 0 && ` · $${allocation}/mo allocation`}
          </p>
        </div>
        <p className="text-3xl font-mono" style={{ color: "#E08558" }}>
          ${dollars}
        </p>
      </div>

      {balance.lowBalance && (
        <p className="text-xs mb-3" style={{ color: "#B5532C" }}>
          Low balance — top up below to keep agents running.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-1.5 text-xs">
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
            Recent activity
          </p>
          {history.map((h) => (
            <div key={h.id} className="flex justify-between text-neutral-400">
              <span className="truncate">
                {h.reason.replace(/_/g, " ")}
                {" · "}
                {new Date(h.createdAt).toLocaleDateString()}
              </span>
              <span
                className={h.deltaCents > 0 ? "text-emerald-400 font-mono" : "text-neutral-400 font-mono"}
              >
                {h.deltaCents > 0 ? "+" : ""}
                ${(Math.abs(h.deltaCents) / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
