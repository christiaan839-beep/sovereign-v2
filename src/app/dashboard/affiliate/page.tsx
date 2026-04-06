"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Link2, Copy, CheckCircle2,
  TrendingUp, Loader2, Gift, ArrowRight,
} from "lucide-react";

interface AffiliateData {
  registered: boolean;
  referralCode?: string;
  referralLink?: string;
  commissionRate?: number;
  stats?: {
    totalReferrals: number;
    converted: number;
    totalEarnings: number;
    pendingEarnings: number;
  };
  recentReferrals?: Array<{
    email: string;
    plan: string;
    status: string;
    revenue: number;
    createdAt: string;
  }>;
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/_misc/affiliate")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const register = async () => {
    setRegistering(true);
    try {
      const res = await fetch("/api/_misc/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", email: "" }),
      });
      const result = await res.json();
      if (result.success || result.referralCode) {
        setData({ registered: true, referralCode: result.referralCode, referralLink: result.referralLink, commissionRate: 20, stats: { totalReferrals: 0, converted: 0, totalEarnings: 0, pendingEarnings: 0 } });
      }
    } catch { /* silent */ }
    setRegistering(false);
  };

  const copyLink = () => {
    if (data?.referralLink) {
      navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Not registered
  if (!data?.registered) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Gift className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Affiliate Program</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Earn 20% recurring commission on every customer you refer. Share your unique link, they sign up, you get paid every month.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 text-sm text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> 20% recurring commission
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Paid monthly via PayPal or bank
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Real-time tracking dashboard
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> No cap on earnings
            </div>
          </div>
          <button
            onClick={register}
            disabled={registering}
            className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Join Affiliate Program
          </button>
        </motion.div>
      </div>
    );
  }

  // Registered — show dashboard
  const stats = data.stats!;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-emerald-400" /> Affiliate Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {data.commissionRate}% recurring commission on every referral
          </p>
        </div>

        {/* Referral Link */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Your Referral Link</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={data.referralLink || ""}
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Referrals", value: stats.totalReferrals, icon: Users, color: "emerald" },
            { label: "Converted", value: stats.converted, icon: TrendingUp, color: "cyan" },
            { label: "Total Earned", value: `$${stats.totalEarnings}`, icon: DollarSign, color: "amber" },
            { label: "Pending", value: `$${stats.pendingEarnings}`, icon: DollarSign, color: "violet" },
          ].map((stat) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`p-2 rounded-lg bg-${stat.color}-500/10 border border-${stat.color}-500/20 w-fit mb-2`}>
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
              </div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-neutral-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Recent Referrals */}
        {data.recentReferrals && data.recentReferrals.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Referrals</h3>
            <div className="space-y-3">
              {data.recentReferrals.map((ref, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">{ref.email}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-600">{ref.plan}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      ref.status === "converted" ? "bg-emerald-500/10 text-emerald-400" : "bg-neutral-500/10 text-neutral-500"
                    }`}>{ref.status}</span>
                    {ref.revenue > 0 && <span className="text-xs text-emerald-400">${ref.revenue}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
