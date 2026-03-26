"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2, DollarSign, Zap, Users, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

const TIERS = [
  { name: "Affiliate", commission: "10%", desc: "Share your referral link. Earn on every sale.", features: ["Unique referral link", "10% recurring commission", "Real-time tracking dashboard", "No minimum sales"] },
  { name: "Reseller", commission: "25%", desc: "White-label the platform. Sell to your clients.", features: ["White-label branding", "25% recurring commission", "Custom domain support", "Priority support", "Client management portal"] },
  { name: "Agency Partner", commission: "40%", desc: "Full partnership. Co-sell with our team.", features: ["40% recurring commission", "Co-branded marketing materials", "Dedicated account manager", "API access for custom integrations", "Revenue share on upsells", "Quarterly strategy sessions"] },
];

const PROOF_POINTS = [
  { metric: "R49,997", label: "Highest Plan Value", icon: DollarSign },
  { metric: "40%", label: "Max Commission Rate", icon: BarChart3 },
  { metric: "Recurring", label: "Monthly Earnings", icon: Zap },
  { metric: "109", label: "Agents You Resell", icon: Users },
];

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-full px-8 h-16 flex items-center justify-between gap-12 pointer-events-auto max-w-5xl w-full">
          <Link href="/" className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-bold tracking-[0.2em] uppercase text-white font-serif">Partners</span>
          </Link>
          <a href="#apply" className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-gpu">
            Apply Now
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-[200px]" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">
            <Building2 className="w-3 h-3" /> Partner Program
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white serif-text mb-6 leading-tight">Sell AI.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Keep 40%.</span></h1>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-12">
            Resell Sovereign Matrix to your clients. White-label it as your own. Earn up to R19,999 per client, every month, forever.
          </p>
        </motion.div>
      </div>

      {/* Proof Points */}
      <div className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROOF_POINTS.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl text-center">
              <p.icon className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white font-mono">{p.metric}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 mt-1 font-bold">{p.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Partner Tiers */}
      <div className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-bold text-white serif-text text-center mb-12">Choose Your Tier</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className={`rounded-2xl p-8 border ${i === 2 ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/10" : "border-white/5 bg-white/[0.02]"}`}>
              <div className="text-4xl font-bold text-white font-mono mb-2">{tier.commission}</div>
              <h3 className="text-lg font-bold text-white mb-2">{tier.name}</h3>
              <p className="text-sm text-neutral-500 mb-6">{tier.desc}</p>
              <ul className="space-y-3">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-4xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-bold text-white serif-text text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Apply", desc: "Submit your agency details. We approve within 24 hours." },
            { step: "02", title: "Customize", desc: "Add your branding, domain, and pricing. We handle the tech." },
            { step: "03", title: "Earn", desc: "Every client you refer or onboard earns you recurring commission." },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl font-bold font-mono text-white/10 mb-4">{s.step}</div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-neutral-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Apply CTA */}
      <div id="apply" className="py-24 text-center px-6 border-t border-white/5">
        <h2 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">Ready to earn?</h2>
        <p className="text-neutral-500 mb-10 max-w-md mx-auto">Join the partner program and start earning recurring revenue from day one.</p>
        <a href="mailto:partners@sovereignmatrix.agency?subject=Partner Program Application" className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-gpu shadow-[0_0_40px_rgba(255,255,255,0.15)] group">
          Apply Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}
