"use client";

import { motion } from "framer-motion";
import { Target, FileText, Search, Mic, Shield, Brain, Zap, Globe, Code2 } from "lucide-react";
import Link from "next/link";

/**
 * BentoGrid — Linear/Vercel-style feature showcase.
 *
 * Complex capabilities shown in a scannable asymmetric grid.
 * Each cell is interactive with hover effects and real data.
 * This is the "wow factor" section that elite SaaS pages use.
 */

const BENTO_ITEMS = [
  {
    title: "130 AI Agents",
    desc: "Lead gen, content, SEO, voice, code, competitive intel. All pre-built. All autonomous.",
    icon: Brain,
    color: "emerald",
    size: "large", // spans 2 columns
    href: "/marketplace",
    stat: "130",
    statLabel: "agents ready",
  },
  {
    title: "39+ Models",
    desc: "Nemotron, Gemini 3.1, DeepSeek, Maverick, Mythos. Auto-routed per task.",
    icon: Zap,
    color: "cyan",
    size: "small",
    href: "/developers/docs",
    stat: "39+",
    statLabel: "models",
  },
  {
    title: "Voice Agents",
    desc: "AI that makes phone calls. Qualifies leads. Books meetings. Discloses AI.",
    icon: Mic,
    color: "violet",
    size: "small",
    href: "/use-cases/lead-gen",
    stat: "<200ms",
    statLabel: "latency",
  },
  {
    title: "5-Layer Safety",
    desc: "Jailbreak detection. PII scanning. Content safety. Quality scoring. Critic review.",
    icon: Shield,
    color: "amber",
    size: "small",
    href: "/security",
    stat: "100%",
    statLabel: "coverage",
  },
  {
    title: "Competitive Intel",
    desc: "Scan any URL. Get weaknesses, market gaps, and a battle plan in 15 seconds.",
    icon: Search,
    color: "emerald",
    size: "small",
    href: "/free/competitor-scan",
    stat: "15s",
    statLabel: "scan time",
  },
  {
    title: "Content Engine",
    desc: "Blog posts, social media, email sequences. Anti-slop. Consensus verified. AI detection <5%.",
    icon: FileText,
    color: "cyan",
    size: "medium",
    href: "/use-cases/content-engine",
    stat: "4.2%",
    statLabel: "AI detection",
  },
  {
    title: "Lead Generation",
    desc: "Find → enrich → score → outreach → follow-up. Full pipeline in one chain.",
    icon: Target,
    color: "violet",
    size: "medium",
    href: "/use-cases/lead-gen",
    stat: "50",
    statLabel: "leads in 45s",
  },
  {
    title: "Global Network",
    desc: "25 hubs across 6 continents. 27 data routes. Zero latency anywhere.",
    icon: Globe,
    color: "emerald",
    size: "small",
    href: "/integrations",
    stat: "25",
    statLabel: "global hubs",
  },
  {
    title: "Developer SDK",
    desc: "Build agents. Publish to marketplace. Earn 80% revenue. The Shopify for AI.",
    icon: Code2,
    color: "cyan",
    size: "small",
    href: "/developers",
    stat: "80%",
    statLabel: "your revenue",
  },
];

export function BentoGrid() {
  return (
    <section className="py-24 px-6 bg-[#020202]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Platform</p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Everything. In one place.
          </h2>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Not a tool with AI bolted on. An operating system where every feature is an autonomous agent.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BENTO_ITEMS.map((item, i) => {
            const colSpan = item.size === "large" ? "md:col-span-2" : item.size === "medium" ? "md:col-span-2" : "";
            const rowSpan = item.size === "large" ? "md:row-span-2" : "";

            return (
              <Link key={item.title} href={item.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02, borderColor: `rgba(${
                    item.color === "emerald" ? "16,185,129" :
                    item.color === "cyan" ? "6,182,212" :
                    item.color === "violet" ? "139,92,246" :
                    "245,158,11"
                  },0.3)` }}
                  className={`${colSpan} ${rowSpan} group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer overflow-hidden`}
                >
                  {/* Background glow on hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-${item.color}-500/[0.05] to-transparent rounded-2xl`} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                      <div className="text-right">
                        <span className={`text-lg font-black text-${item.color}-400`}>{item.stat}</span>
                        <span className="block text-[8px] text-neutral-600 uppercase tracking-wider">{item.statLabel}</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{item.title}</h3>
                    <p className="text-[11px] text-neutral-500 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
