"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, ExternalLink, Activity, CheckCircle2, Zap, BarChart3,
  Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useUsage } from "@/hooks/useUsage";
import { useSafeUser } from "@/lib/safe-clerk";
import { Skeleton } from "@/components/ui/Skeleton";

export default function BillingPortal() {
  const { today, limit, total, plan, loaded } = useUsage();
  const { user } = useSafeUser();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const attemptCheckout = async (endpoint: string, planId: string, email: string) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, email }),
    });
    if (res.status === 503) return null; // provider unavailable, try next
    const data = await res.json();
    return data.checkoutUrl || null;
  };

  const handleUpgrade = async (planId: string) => {
    setCheckoutError(null);
    setCheckoutLoading(planId);
    const email = user?.emailAddresses?.[0]?.emailAddress || "";
    const providers = [
      "/api/payments/yoco/checkout",
      "/api/_payments/paystack/checkout",
      "/api/_payments/payfast/webhook",
    ];
    try {
      let checkoutUrl: string | null = null;
      for (const endpoint of providers) {
        checkoutUrl = await attemptCheckout(endpoint, planId, email);
        if (checkoutUrl) break;
      }
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setCheckoutError("All payment providers are currently unavailable. Please try again later.");
      }
    } catch {
      setCheckoutError("Connection failed. Please check your internet and try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const PLANS = [
    {
      name: "Free",
      planId: "starter",
      price: "R0",
      period: "/month",
      features: [
        "10 agent calls/day",
        "3 NIM models",
        "Community support",
        "1 workspace",
      ],
      current: plan === "starter",
    },
    {
      name: "Pro",
      planId: "pro",
      price: "R499",
      period: "/month",
      features: [
        "100 agent calls/day",
        "39 NIM models",
        "Priority support",
        "5 workspaces",
        "White-label",
      ],
      current: plan === "pro",
      recommended: true,
    },
    {
      name: "Enterprise",
      planId: "enterprise",
      price: "Custom",
      period: "",
      features: [
        "Unlimited calls",
        "All models + local NemoClaw",
        "Dedicated support",
        "Unlimited workspaces",
        "Custom agents",
        "SOC2 compliance",
      ],
      current: plan === "enterprise",
    },
  ];

  return (
    <div
      className="max-w-5xl mx-auto space-y-8 p-4 lg:p-8"
      role="main"
      aria-label="Billing and subscription management"
    >
      {/* Header */}
      <header className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Billing</h1>
            <p className="text-neutral-400 text-xs">
              Manage your subscription and usage
            </p>
          </div>
        </div>
      </header>

      {/* Checkout Error Banner */}
      {checkoutError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300 flex-1">{checkoutError}</p>
          <button
            onClick={() => setCheckoutError(null)}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Free Plan Banner */}
      {loaded && plan === "starter" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5"
        >
          <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              You&apos;re on the Free plan
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {today}/{limit} agent calls used today. Upgrade to Pro for 10x more capacity and premium models.
            </p>
          </div>
        </motion.div>
      )}

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Today",
            value: `${today}/${limit}`,
            icon: Zap,
            color: "text-cyan-400",
          },
          {
            label: "All Time",
            value: `${total}`,
            icon: BarChart3,
            color: "text-emerald-400",
          },
          {
            label: "Plan",
            value:
              plan === "starter"
                ? "Free"
                : plan.charAt(0).toUpperCase() + plan.slice(1),
            icon: Activity,
            color: "text-violet-400",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-neutral-400">{stat.label}</span>
            </div>
            {!loaded ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {stat.value}
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Plans */}
      {!loaded ? (
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] space-y-4 animate-pulse"
            >
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.planId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className={`p-6 rounded-2xl border transition-gpu ${
                p.current
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : p.recommended
                  ? "border-white/10 bg-white/[0.02] hover:border-white/20"
                  : "border-white/5 bg-white/[0.01] hover:border-white/10"
              }`}
            >
              {p.current && (
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-3 block">
                  Current Plan
                </span>
              )}
              {p.recommended && !p.current && (
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-3 block">
                  Recommended
                </span>
              )}
              <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-white">
                  {p.price}
                </span>
                <span className="text-sm text-neutral-400">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-2 text-sm text-neutral-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {p.current ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/5 text-neutral-400 text-sm font-medium cursor-default"
                  aria-label={`${p.name} plan is active`}
                >
                  Active
                </button>
              ) : p.name === "Enterprise" ? (
                <a
                  href="mailto:hello@sovereignmatrix.agency"
                  className="w-full py-3 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  Contact Sales <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <button
                  onClick={() => handleUpgrade(p.planId)}
                  disabled={checkoutLoading === p.planId}
                  className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  aria-label={`Upgrade to ${p.name} plan`}
                >
                  {checkoutLoading === p.planId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Upgrade"
                  )}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Payment provider note */}
      {loaded && (
        <div className="flex items-center justify-center gap-2 py-2">
          <CreditCard className="w-3 h-3 text-neutral-500" />
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
            Powered by Yoco
          </span>
        </div>
      )}

      {/* Usage Breakdown — Empty state for free users */}
      {loaded && plan === "starter" && total === 0 && (
        <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.01]">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-5 h-5 text-neutral-500" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">
            No usage yet
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Run your first agent from the dashboard to start tracking usage
            here. Your daily limit resets at midnight UTC.
          </p>
        </div>
      )}
    </div>
  );
}
