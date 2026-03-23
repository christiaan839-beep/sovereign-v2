"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
  Factory, Search, Palette, Users, Shield,
  ArrowRight, Globe2, Zap, Swords,
  TrendingUp, BarChart3, Rocket, Key,
} from 'lucide-react';
import Link from 'next/link';
import { useUser } from "@clerk/nextjs";
import { QuickStartWizard } from "@/components/dashboard/QuickStartWizard";
import { useUsage } from "@/hooks/useUsage";
import { GlobalStrikeMap } from "@/components/3d/GlobalStrikeMap";

const TOOLS = [
  {
    label: "Content Hub",
    description: "Blog posts, email sequences, social packs, and video scripts — all AI-generated.",
    href: "/dashboard/content-factory",
    icon: Factory,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    label: "SEO Tools",
    description: "Competitor X-Ray, content gap analysis, schema audit, and GBP hijack.",
    href: "/dashboard/seo-dominator",
    icon: Search,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  {
    label: "Design Studio",
    description: "Landing page briefs, brand identity systems, and UI/UX specifications.",
    href: "/dashboard/designer",
    icon: Palette,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    label: "Lead Prospector",
    description: "Find local businesses, detect marketing gaps, and generate outreach.",
    href: "/dashboard/leads",
    icon: Users,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    label: "Competitor Intel",
    description: "AI-powered competitive analysis with threat detection and counter-strategies.",
    href: "/dashboard/competitor",
    icon: Swords,
    color: "text-[#00B7FF]",
    bg: "bg-[#00B7FF]/10",
    border: "border-[#00B7FF]/20",
  },
  {
    label: "Page Builder",
    description: "Generate production-ready landing pages with Gemini 2.5 Pro in seconds.",
    href: "/dashboard/page-builder",
    icon: Globe2,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
];


const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: delay * 0.1, ease: [0.16, 1, 0.3, 1] as const },
});

export default function DashboardOverview() {
  const { user } = useUser();
  const firstName = user?.firstName || "there";
  const { today, limit, remaining, total, plan } = useUsage();

  const STATS = [
    { label: "Today", value: `${today}/${limit}`, icon: Zap, color: "text-[#00B7FF]" },
    { label: "Remaining", value: `${remaining}`, icon: BarChart3, color: remaining > 5 ? "text-emerald-400" : remaining > 0 ? "text-amber-400" : "text-rose-400" },
    { label: "All Time", value: `${total}`, icon: TrendingUp, color: "text-violet-400" },
    { label: "Plan", value: plan === "starter" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1), icon: Shield, color: plan === "starter" ? "text-neutral-400" : "text-emerald-400" },
  ];
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 relative z-10 p-4 lg:p-8">
      
      {/* Welcome Header */}
      <motion.div {...fade(0)} className="backdrop-blur-3xl bg-black/40 p-6 lg:p-8 rounded-2xl shadow-[0_0_50px_rgba(0,183,255,0.05)] border border-[#00B7FF]/10">
        <h1 className="text-2xl lg:text-3xl font-light text-white tracking-wide mb-2">
          Welcome back, <span className="font-bold text-[#00B7FF]">{firstName}</span>
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl">
          Your AI marketing engine is ready. Choose a tool below to generate content, analyze competitors, find leads, or build your next campaign.
        </p>
      </motion.div>

      {/* Quick Actions — reduces cognitive overload */}
      <motion.div {...fade(0.3)} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Factory, label: "Create Content", href: "/dashboard/content-factory", color: "text-emerald-400" },
          { icon: Users, label: "Find Leads", href: "/dashboard/leads", color: "text-amber-400" },
          { icon: Shield, label: "Audit Site", href: "/dashboard/cyber-audit", color: "text-rose-400" },
          { icon: Swords, label: "Scan Competitor", href: "/dashboard/competitor", color: "text-violet-400" },
          { icon: Globe2, label: "Build Page", href: "/dashboard/page-builder", color: "text-cyan-400" },
          { icon: Rocket, label: "Voice Assistant", href: "/dashboard/voice-assistant", color: "text-[#00B7FF]" },
        ].map((action, i) => (
          <Link key={i} href={action.href}
            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 hover:-translate-y-0.5 transition-all duration-300 text-center"
          >
            <action.icon className={`w-5 h-5 ${action.color} group-hover:scale-110 transition-transform`} />
            <span className="text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">{action.label}</span>
          </Link>
        ))}
      </motion.div>

      {/* Global Strike Visualization (Palantir Architecture) */}
      <motion.div {...fade(0.5)} className="bg-black border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden">
         <div className="absolute top-6 left-6 z-20">
            <h2 className="text-xl font-serif font-bold text-white">Global Reconnaissance</h2>
            <p className="text-xs text-neutral-500 font-mono tracking-widest uppercase mt-1">Live Strike Nodes</p>
         </div>
         <GlobalStrikeMap />
      </motion.div>

      {/* Quick Start Guide */}
      <QuickStartWizard />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={i}
            {...fade(i + 1)}
            className="bg-black/40 backdrop-blur-2xl border border-[#00B7FF]/10 rounded-2xl p-5 relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${s.color}`}>
              <s.icon className="w-14 h-14" />
            </div>
            <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
            <p className="text-2xl font-bold text-white font-mono">{s.value}</p>
            <p className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest font-bold">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tools Grid */}
      <div>
        <motion.h2 {...fade(5)} className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold mb-4 flex items-center gap-2">
          <Rocket className="w-3 h-3" /> Your AI Toolkit
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TOOLS.map((tool, i) => (
            <motion.div key={tool.href} {...fade(6 + i)}>
              <Link
                href={tool.href}
                className={`block p-6 rounded-2xl border ${tool.border} ${tool.bg} backdrop-blur-2xl hover:scale-[1.02] transition-all group`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${tool.bg} border ${tool.border} flex items-center justify-center`}>
                    <tool.icon className={`w-4 h-4 ${tool.color}`} />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wider uppercase">{tool.label}</h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">{tool.description}</p>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-neutral-500 group-hover:text-white transition-colors">
                  Open tool <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* API Key Nudge */}
      <motion.div {...fade(12)}>
        <Link href="/dashboard/settings" className="block bg-black/40 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 hover:border-amber-500/40 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Add Your API Key</h3>
              <p className="text-xs text-neutral-500">Plug in your Gemini, Claude, or Tavily API key in Settings to unlock all AI tools. Free to add — you control your own usage.</p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </motion.div>

      {/* ROI Comparison */}
      <motion.div {...fade(13)} className="bg-black/40 backdrop-blur-3xl border border-[#00B7FF]/10 rounded-2xl p-6">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" /> Your Savings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-lg font-mono font-bold text-red-400 line-through">R15,000+</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Traditional Agency</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <p className="text-lg font-mono font-bold text-amber-400 line-through">R25,000+</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">In-House Team</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-lg font-mono font-bold text-emerald-400">Free to Start</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">SOVEREIGN Platform</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
