"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Copy, Check, Gift, Zap, DollarSign,
  Share2, Twitter, Linkedin, Mail, ArrowRight,
  UserPlus, Sparkles, TrendingUp, Clock,
} from "lucide-react";
import { useSafeUser } from "@/lib/safe-clerk";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

interface ReferralRecord {
  id: string;
  email: string;
  date: string;
  status: "active" | "pending" | "churned";
  plan: string;
}

const COMMISSION_TIERS = [
  {
    tier: "Affiliate",
    rate: "10%",
    description: "Share your link and earn on every referral&apos;s subscription",
    color: "emerald",
    icon: Share2,
  },
  {
    tier: "Reseller",
    rate: "25%",
    description: "Manage 10+ active referrals to unlock reseller commission",
    color: "cyan",
    icon: TrendingUp,
  },
  {
    tier: "Agency Partner",
    rate: "40%",
    description: "White-label and resell with dedicated partner support",
    color: "violet",
    icon: Sparkles,
  },
];

export default function ReferralsPage() {
  const { user } = useSafeUser();
  const [copied, setCopied] = useState(false);
  const [referrals] = useState<ReferralRecord[]>([]);

  // Build referral link from user ID
  const userId = user?.id || "YOUR_ID";
  const referralLink = `https://sovereignmatrix.agency?ref=${userId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const shareTextRaw = `I'm using Sovereign Matrix -- ${TOTAL_AGENTS} AI agents that actually execute. Find leads, write content, make calls, all automated. Try it free:`;

  // Stats derived from referral data (honest zeros for now)
  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter((r) => r.status === "active").length;
  const estimatedRevenue = activeReferrals * 4.9; // 10% of $49 average

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 lg:p-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            <Users className="w-3 h-3" /> Referrals
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Invite others to Sovereign Matrix and earn recurring commissions on every subscription.
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Referrals",
            value: totalReferrals.toString(),
            icon: UserPlus,
            color: "text-emerald-400",
          },
          {
            label: "Active Referrals",
            value: activeReferrals.toString(),
            icon: Users,
            color: "text-cyan-400",
          },
          {
            label: "Revenue Earned",
            value: estimatedRevenue > 0 ? `$${estimatedRevenue.toFixed(2)}` : "$0.00",
            icon: DollarSign,
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
            <span className="text-2xl font-bold text-white">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Referral Link Generator */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]"
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Your Referral Link</span>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Share this link. When someone signs up through it, you&apos;ll earn a commission on their subscription.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-sm text-neutral-300 font-mono outline-none"
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </motion.div>

      {/* Share Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-sm font-semibold text-white mb-3">Share via</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTextRaw)}&url=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20"
          >
            <Twitter className="w-4 h-4" />
            Twitter
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
          >
            <Linkedin className="w-4 h-4" />
            LinkedIn
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("Try Sovereign Matrix — AI agents that actually work")}&body=${encodeURIComponent(shareTextRaw + "\n\n" + referralLink)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        </div>
      </motion.div>

      {/* Commission Tiers */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-sm font-semibold text-white mb-4">Commission Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COMMISSION_TIERS.map((tier, i) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={`p-5 rounded-xl border transition-colors ${
                i === 0
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-white/5 bg-white/[0.01] hover:border-white/10"
              }`}
            >
              <tier.icon className={`w-5 h-5 mb-3 ${
                tier.color === "emerald" ? "text-emerald-400" :
                tier.color === "cyan" ? "text-cyan-400" : "text-violet-400"
              }`} />
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-black text-white">{tier.rate}</span>
                <span className="text-xs text-neutral-500">commission</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{tier.tier}</h3>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                {tier.tier === "Affiliate" && "Share your link and earn on every referral\u2019s subscription"}
                {tier.tier === "Reseller" && "Manage 10+ active referrals to unlock reseller commission"}
                {tier.tier === "Agency Partner" && "White-label and resell with dedicated partner support"}
              </p>
              {i === 0 && (
                <span className="inline-block mt-3 text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                  Your current tier
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Referral History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-sm font-semibold text-white mb-4">Referral History</h2>
        {referrals.length > 0 ? (
          <div className="border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Referral</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Date</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Plan</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-neutral-500 px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-white/[0.03] last:border-0">
                    <td className="px-5 py-4 text-sm text-neutral-300">{ref.email}</td>
                    <td className="px-5 py-4 text-sm text-neutral-400">{ref.date}</td>
                    <td className="px-5 py-4 text-sm text-neutral-300">{ref.plan}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ref.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : ref.status === "pending"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                      }`}>
                        {ref.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.01]">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-5 h-5 text-neutral-500" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">No referrals yet</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Share your referral link above to start earning commissions. Your referred users will appear here.
            </p>
          </div>
        )}
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
      >
        <h2 className="text-sm font-semibold text-white mb-5">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Share",
              description: "Copy your unique referral link and share it with your network",
              icon: Share2,
            },
            {
              step: "2",
              title: "They sign up",
              description: "Your referral creates an account and starts using the platform",
              icon: UserPlus,
            },
            {
              step: "3",
              title: "You earn",
              description: "Earn recurring commission on every subscription they pay for",
              icon: DollarSign,
            },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
                  {item.step}
                </span>
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed pl-11">
                {item.description}
              </p>
              {i < 2 && (
                <ArrowRight className="hidden sm:block absolute -right-3 top-4 w-4 h-4 text-neutral-700" />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bonus Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02]"
      >
        <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="text-xs text-neutral-400">
          <span className="text-emerald-400 font-semibold">Bonus:</span>{" "}
          Both you and your referral get 50 extra agent runs when they sign up — on top of commissions.
        </p>
      </motion.div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-2">
        <Clock className="w-3 h-3 text-neutral-600" />
        <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
          Commissions paid monthly. Questions?{" "}
          <a
            href="mailto:hello@sovereignmatrix.agency"
            className="text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            hello@sovereignmatrix.agency
          </a>
        </span>
      </div>
    </div>
  );
}
