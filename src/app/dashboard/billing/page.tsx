"use client";

import { motion } from "framer-motion";
import { CreditCard, ExternalLink, Activity, CheckCircle2, Zap, BarChart3 } from "lucide-react";
import { useUsage } from "@/hooks/useUsage";
import { useSafeUser } from "@/lib/safe-clerk";

export default function BillingPortal() {
  const { today, limit, total, plan } = useUsage();
  const { user } = useSafeUser();

  const handleUpgrade = async (planId: string) => {
    try {
      const res = await fetch("/api/payments/payfast/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email: user?.emailAddresses?.[0]?.emailAddress || "" }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      }
    } catch (error) {
      console.error("Checkout failed:", error);
    }
  };

  const PLANS = [
    {
      name: "Free",
      planId: "starter",
      price: "R0",
      period: "/month",
      features: ["10 agent calls/day", "3 NIM models", "Community support", "1 workspace"],
      current: plan === "starter",
    },
    {
      name: "Pro",
      planId: "pro",
      price: "R499",
      period: "/month",
      features: ["100 agent calls/day", "39 NIM models", "Priority support", "5 workspaces", "White-label"],
      current: plan === "pro",
      recommended: true,
    },
    {
      name: "Enterprise",
      planId: "enterprise",
      price: "Custom",
      period: "",
      features: ["Unlimited calls", "All models + local NemoClaw", "Dedicated support", "Unlimited workspaces", "Custom agents", "SOC2 compliance"],
      current: plan === "enterprise",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 lg:p-8">

      <header className="pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Billing</h1>
            <p className="text-neutral-500 text-xs">Manage your subscription and usage</p>
          </div>
        </div>
      </header>

      {/* Usage Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today", value: `${today}/${limit}`, icon: Zap, color: "text-cyan-400" },
          { label: "All Time", value: `${total}`, icon: BarChart3, color: "text-emerald-400" },
          { label: "Plan", value: plan === "starter" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1), icon: Activity, color: "text-violet-400" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-white/[0.02] border border-white/5 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-neutral-500">{stat.label}</span>
            </div>
            <span className="text-2xl font-bold text-white">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className={`p-6 rounded-2xl border transition-all ${
              p.current
                ? "border-emerald-500/30 bg-emerald-500/5"
                : p.recommended
                ? "border-white/10 bg-white/[0.02] hover:border-white/20"
                : "border-white/5 bg-white/[0.01] hover:border-white/10"
            }`}
          >
            {p.current && (
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-3 block">Current Plan</span>
            )}
            {p.recommended && !p.current && (
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-3 block">Recommended</span>
            )}
            <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-black text-white">{p.price}</span>
              <span className="text-sm text-neutral-500">{p.period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {p.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm text-neutral-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {p.current ? (
              <button className="w-full py-3 rounded-xl bg-white/5 text-neutral-400 text-sm font-medium cursor-default">
                Active
              </button>
            ) : p.name === "Enterprise" ? (
              <a href="mailto:hello@sovereignmatrix.agency" className="w-full py-3 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                Contact Sales <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => handleUpgrade(p.planId)}
                className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
              >
                Upgrade
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
