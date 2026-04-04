"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Check, Users, Zap, Share2, Twitter, Linkedin, Mail, MessageCircle } from "lucide-react";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferred: number;
  bonusRuns: number;
  bonusPerReferral: number;
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    if (data?.referralLink) {
      navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareText = `I'm using Sovereign Matrix — 130+ AI agents that actually execute. Find leads, write content, make calls, all automated. Try it free:`;

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Gift className="w-3 h-3" /> Referral Program
        </div>
        <h1 className="text-2xl font-bold text-white">Invite friends. Earn bonus runs.</h1>
        <p className="text-neutral-500 text-sm mt-1">Share your link. When someone signs up, you both get {data?.bonusPerReferral || 50} bonus agent runs.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Friends Referred", value: data?.totalReferred ?? 0, icon: Users, color: "emerald" },
          { label: "Bonus Runs Earned", value: data?.bonusRuns ?? 0, icon: Zap, color: "cyan" },
          { label: "Per Referral", value: `+${data?.bonusPerReferral ?? 50}`, icon: Gift, color: "amber" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            <stat.icon className={`w-4 h-4 text-${stat.color}-400 mb-2`} />
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Your Referral Link</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={data?.referralLink || ""}
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-sm text-neutral-300 font-mono outline-none"
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-3">Share via</h3>
        <div className="flex gap-3">
          {[
            { name: "Twitter", icon: Twitter, color: "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(data?.referralLink || "")}` },
            { name: "LinkedIn", icon: Linkedin, color: "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data?.referralLink || "")}` },
            { name: "WhatsApp", icon: MessageCircle, color: "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20", href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + (data?.referralLink || ""))}` },
            { name: "Email", icon: Mail, color: "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20", href: `mailto:?subject=${encodeURIComponent("Try Sovereign Matrix — AI agents that actually work")}&body=${encodeURIComponent(shareText + "\n\n" + (data?.referralLink || ""))}` },
          ].map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${social.color}`}
            >
              <social.icon className="w-4 h-4" />
              {social.name}
            </a>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-white mb-4">How it works</h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Share your unique referral link with a friend" },
            { step: "2", text: "They sign up and start using Sovereign Matrix" },
            { step: "3", text: `You both get ${data?.bonusPerReferral || 50} bonus agent runs — instantly` },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">{item.step}</span>
              <span className="text-sm text-neutral-400">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
