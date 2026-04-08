"use client";

import { motion } from "framer-motion";
import { Map, CreditCard, Store, Wand2, ShieldCheck, Smartphone, Code2, Brain, Webhook, Phone, Sparkles, Globe, Network, ClipboardCheck, Server, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

const PHASES = [
  {
    label: "NOW",
    quarter: "Q2 2026",
    status: "In Progress",
    color: "emerald",
    items: [
      { icon: CreditCard, title: "Stripe checkout integration", description: "Accept payments, activate paid plans" },
      { icon: Store, title: "Agent Marketplace v2", description: "Developer submissions, revenue sharing, agent reviews" },
      { icon: Wand2, title: "Dashboard first-run wizard", description: "Guided activation from signup to first output" },
      { icon: ShieldCheck, title: "SOC 2 Type II certification", description: "Enterprise security compliance (in progress)" },
      { icon: Smartphone, title: "Mobile responsive audit", description: "Full mobile optimization for all pages" },
    ],
  },
  {
    label: "NEXT",
    quarter: "Q3 2026",
    status: "Planned",
    color: "cyan",
    items: [
      { icon: Code2, title: "Agent SDK v1.0", description: "TypeScript SDK for building and publishing custom agents" },
      { icon: Brain, title: "Cross-agent learning", description: "Anonymized insights flow between agents to improve routing" },
      { icon: Webhook, title: "Webhook marketplace", description: "Pre-built automations for Slack, HubSpot, Salesforce triggers" },
      { icon: Phone, title: "Voice agent outbound", description: "AI phone calls for lead qualification and meeting booking" },
      { icon: Sparkles, title: "Custom model fine-tuning", description: "Train models on your data for brand-specific outputs" },
    ],
  },
  {
    label: "LATER",
    quarter: "Q4 2026+",
    status: "Exploring",
    color: "violet",
    items: [
      { icon: Globe, title: "Multi-tenant white-label API", description: "Full API surface for agency resellers" },
      { icon: Network, title: "Agent-to-agent protocol", description: "Sovereign agents communicate with external agent frameworks" },
      { icon: ClipboardCheck, title: "Compliance dashboard", description: "Real-time GDPR/SOC2/HIPAA compliance monitoring" },
      { icon: Server, title: "On-premise deployment", description: "Full Sovereign stack running on customer infrastructure" },
      { icon: Bot, title: "Autonomous business units", description: "Agents that manage P&L, hire other agents, and self-optimize" },
    ],
  },
] as const;

const COLOR_MAP: Record<string, { border: string; dot: string; dotInner: string; badge: string; badgeText: string; line: string; hoverBorder: string }> = {
  emerald: {
    border: "border-l-emerald-500",
    dot: "bg-emerald-500/20 border-emerald-500",
    dotInner: "bg-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/30",
    badgeText: "text-emerald-400",
    line: "from-emerald-500/50 via-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/30",
  },
  cyan: {
    border: "border-l-cyan-500",
    dot: "bg-cyan-500/20 border-cyan-500",
    dotInner: "bg-cyan-400",
    badge: "bg-cyan-500/10 border-cyan-500/30",
    badgeText: "text-cyan-400",
    line: "from-cyan-500/50 via-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/30",
  },
  violet: {
    border: "border-l-violet-500",
    dot: "bg-violet-500/20 border-violet-500",
    dotInner: "bg-violet-400",
    badge: "bg-violet-500/10 border-violet-500/30",
    badgeText: "text-violet-400",
    line: "from-violet-500/50 via-violet-500/20",
    hoverBorder: "hover:border-violet-500/30",
  },
};

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#010101]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold tracking-tight text-sm">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">S</span>
            </div>
            Sovereign Matrix
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-4">
            <Map className="w-3 h-3" /> Roadmap
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
            Where we&apos;re going.
          </h1>
          <p className="text-neutral-500 max-w-lg mx-auto">
            Transparent roadmap. Built in public.
          </p>
        </motion.div>

        {/* Phases */}
        <div className="space-y-12">
          {PHASES.map((phase, pi) => {
            const colors = COLOR_MAP[phase.color];
            return (
              <motion.div
                key={phase.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pi * 0.15 }}
              >
                {/* Phase card */}
                <div
                  className={`rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden border-l-4 ${colors.border}`}
                >
                  {/* Phase header */}
                  <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-white tracking-tight">{phase.label}</span>
                      <span className="text-xs font-mono text-neutral-500">{phase.quarter}</span>
                    </div>
                    <span
                      className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${colors.badge} ${colors.badgeText}`}
                    >
                      {phase.status}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="relative">
                    {/* Vertical accent line */}
                    <div
                      className={`absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b ${colors.line} to-transparent`}
                    />

                    <div className="py-2">
                      {phase.items.map((item, ii) => {
                        const Icon = item.icon;
                        return (
                          <motion.div
                            key={item.title}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: pi * 0.15 + ii * 0.06 }}
                            className="relative pl-14 pr-5 py-3 flex items-start gap-3"
                          >
                            {/* Status dot */}
                            <div
                              className={`absolute left-[20px] top-[18px] w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center ${colors.dot}`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${colors.dotInner}`} />
                            </div>

                            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colors.badgeText}`} />
                            <div>
                              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                              <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl px-6 py-8">
            <p className="text-neutral-400 mb-4">
              Want to influence the roadmap? Join as an early user.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-cyan-500 transition-all"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
